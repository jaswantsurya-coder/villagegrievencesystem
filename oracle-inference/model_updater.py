"""
GramSeva AI — Model Updater
Hot-swap LoRA adapters without server downtime.
Supports automatic detection of new model versions and safe rollback.
"""

import os
import shutil
import logging
import json
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger("gramseva.model_updater")


class ModelUpdater:
    """
    Hot-swap LoRA adapters without restarting the FastAPI server.

    Workflow:
      1. Detect new adapter version in MODELS_DIR
      2. Backup current adapter
      3. Load new adapter into model_manager
      4. Run health check (dummy inference)
      5. If OK: switch traffic, update version
      6. If fail: rollback to backup
    """

    def __init__(self, model_manager, models_dir: str = ""):
        self.model_manager = model_manager
        self.models_dir = Path(models_dir or os.environ.get("MODELS_DIR", "/opt/gramseva/models/adapters"))
        self.backup_dir = self.models_dir / "_backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def list_available_versions(self) -> list[dict]:
        """List all adapter versions available in MODELS_DIR."""
        versions = []
        if not self.models_dir.exists():
            return versions

        for entry in sorted(self.models_dir.iterdir()):
            if entry.is_dir() and entry.name.startswith("gramseva_model"):
                config_path = entry / "adapter_config.json"
                if config_path.exists():
                    try:
                        with open(config_path) as f:
                            config = json.load(f)
                        versions.append({
                            "name": entry.name,
                            "path": str(entry),
                            "base_model": config.get("base_model_name_or_path", "unknown"),
                            "peft_type": config.get("peft_type", "unknown"),
                            "lora_r": config.get("r", 0),
                        })
                    except Exception:
                        pass
        return versions

    def reload(self, adapter_path: str, new_version: str) -> dict:
        """
        Attempt to hot-swap the LoRA adapter.
        Returns a result dict with success/failure details.
        """
        old_version = self.model_manager.MODEL_VERSION
        old_adapter_path = self.model_manager.adapter_path
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        logger.info(f"[ModelUpdater] Attempting upgrade: {old_version} → {new_version}")

        # 1. Backup current adapter
        backup_path = self.backup_dir / f"{old_version}_{timestamp}"
        try:
            if old_adapter_path and Path(old_adapter_path).exists():
                shutil.copytree(old_adapter_path, backup_path)
                logger.info(f"[ModelUpdater] Backed up {old_version} to {backup_path}")
        except Exception as e:
            logger.warning(f"[ModelUpdater] Backup failed (non-fatal): {e}")

        # 2. Load new adapter
        try:
            self.model_manager.reload_adapter(adapter_path)
        except Exception as e:
            logger.error(f"[ModelUpdater] Failed to load new adapter: {e}")
            # Rollback
            if old_adapter_path:
                try:
                    self.model_manager.reload_adapter(old_adapter_path)
                    logger.info(f"[ModelUpdater] Rolled back to {old_version}")
                except Exception as re:
                    logger.critical(f"[ModelUpdater] ROLLBACK ALSO FAILED: {re}")
            return {
                "success": False,
                "error": str(e),
                "rolled_back_to": old_version,
            }

        # 3. Health check — run dummy inference
        try:
            test_result = self.model_manager.classify("Road damaged urgently needs repair in village")
            if not test_result or not test_result.get("category"):
                raise ValueError("Health check inference returned empty result")
            logger.info(f"[ModelUpdater] Health check passed: {test_result.get('category')}")
        except Exception as e:
            logger.error(f"[ModelUpdater] Health check failed: {e}")
            # Rollback
            if old_adapter_path:
                try:
                    self.model_manager.reload_adapter(old_adapter_path)
                    self.model_manager.MODEL_VERSION = old_version
                    logger.info(f"[ModelUpdater] Rolled back to {old_version}")
                except Exception as re:
                    logger.critical(f"[ModelUpdater] ROLLBACK ALSO FAILED: {re}")
            return {
                "success": False,
                "error": f"Health check failed: {e}",
                "rolled_back_to": old_version,
            }

        # 4. Success — update version
        self.model_manager.MODEL_VERSION = new_version
        self.model_manager.adapter_path = adapter_path
        logger.info(f"[ModelUpdater] ✅ Upgrade complete: {old_version} → {new_version}")

        return {
            "success": True,
            "old_version": old_version,
            "new_version": new_version,
            "adapter_path": adapter_path,
            "backup_path": str(backup_path) if backup_path.exists() else None,
            "health_check": "passed",
        }
