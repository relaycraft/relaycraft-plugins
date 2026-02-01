import os
import json
import yaml
import shutil
import zipfile
import sys

# Configuration
DIST_DIR = "dist"
PLUGINS_JSON_FILE = "plugins.json"
REPO_NAME = os.environ.get("GITHUB_REPOSITORY", "relaycraft/relaycraft-plugins")
# Use run_number to generate a unique tag for this run
RUN_NUMBER = os.environ.get("GITHUB_RUN_NUMBER", "1")
TAG_NAME = f"v1.0.{RUN_NUMBER}" # Simple incremental versioning for the release tag
DOWNLOAD_BASE_URL = f"https://github.com/{REPO_NAME}/releases/download/{TAG_NAME}"

def load_plugins_json():
    if not os.path.exists(PLUGINS_JSON_FILE):
        return {"version": "1.0", "plugins": []}
    with open(PLUGINS_JSON_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_plugins_json(data):
    with open(PLUGINS_JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def find_plugin_dirs():
    plugin_dirs = []
    for item in os.listdir("."):
        if os.path.isdir(item) and not item.startswith(".") and item not in ["scripts", "dist", ".github"]:
            if os.path.exists(os.path.join(item, "plugin.yaml")):
                plugin_dirs.append(item)
    return plugin_dirs

def build_plugin(plugin_dir, output_dir):
    with open(os.path.join(plugin_dir, "plugin.yaml"), "r", encoding="utf-8") as f:
        manifest = yaml.safe_load(f)
    
    plugin_id = manifest.get("id")
    version = manifest.get("version")
    
    if not plugin_id or not version:
        print(f"Skipping {plugin_dir}: Missing id or version in plugin.yaml")
        return None

    filename = f"{plugin_id}-v{version}.rcplugin"
    output_path = os.path.join(output_dir, filename)
    
    # Create zip file (renamed to .rcplugin)
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(plugin_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # Calculate archive name (relative path inside the zip)
                # We want the root of the zip to be the contents of the plugin dir
                arcname = os.path.relpath(file_path, plugin_dir)
                zipf.write(file_path, arcname)
    
    print(f"Built {filename}")
    return {
        "id": plugin_id,
        "version": version,
        "filename": filename,
        "manifest": manifest
    }

def main():
    if not os.path.exists(DIST_DIR):
        os.makedirs(DIST_DIR)
        
    plugins_data = load_plugins_json()
    existing_plugins_map = {p["id"]: p for p in plugins_data.get("plugins", [])}
    
    plugin_dirs = find_plugin_dirs()
    updated_count = 0
    
    print(f"Found plugin directories: {plugin_dirs}")
    
    for p_dir in plugin_dirs:
        build_result = build_plugin(p_dir, DIST_DIR)
        if not build_result:
            continue
            
        p_id = build_result["id"]
        p_version = build_result["version"]
        filename = build_result["filename"]
        manifest = build_result["manifest"]
        
        # Update or add entry in plugins.json
        # We always update the downloadUrl to point to the new release asset
        # This ensures that even if version didn't change, the link is valid for the new tag
        # But logically, we should probably only update if something changed.
        # For simplicity in this workflow, we assume every push to main that triggers this
        # might be a release.
        
        download_url = f"{DOWNLOAD_BASE_URL}/{filename}"
        
        entry = existing_plugins_map.get(p_id, {})
        
        # Update fields from manifest
        entry["id"] = p_id
        entry["name"] = manifest.get("name", entry.get("name"))
        entry["version"] = p_version
        entry["description"] = manifest.get("description", entry.get("description"))
        entry["author"] = manifest.get("author", entry.get("author"))
        entry["icon"] = manifest.get("icon", entry.get("icon"))
        entry["category"] = manifest.get("category", entry.get("category", "utility")) # Default category
        entry["downloadUrl"] = download_url
        
        # Preserve other fields like locales if they exist in json but not manifest (though usually manifest is source of truth)
        # Here we trust manifest + existing json extras
        
        existing_plugins_map[p_id] = entry
        updated_count += 1
        
    # Reconstruct plugins list
    plugins_data["plugins"] = list(existing_plugins_map.values())
    save_plugins_json(plugins_data)
    
    print(f"Updated plugins.json with {updated_count} plugins.")
    
    # Export TAG_NAME for GitHub Actions
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"tag_name={TAG_NAME}\n")

if __name__ == "__main__":
    main()
