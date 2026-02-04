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
    
    # Create zip file
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(plugin_dir):
            for file in files:
                file_path = os.path.join(root, file)
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
    releases_to_create = []
    
    print(f"Found plugin directories: {plugin_dirs}")
    
    for p_dir in plugin_dirs:
        try:
            with open(os.path.join(p_dir, "plugin.yaml"), "r", encoding="utf-8") as f:
                manifest = yaml.safe_load(f)
        except Exception as e:
            print(f"Error loading manifest for {p_dir}: {e}")
            continue

        p_id = manifest.get("id")
        p_version = manifest.get("version")
        p_name = manifest.get("name", p_id)

        # Check if version has changed
        existing_plugin = existing_plugins_map.get(p_id)
        if existing_plugin and existing_plugin.get("version") == p_version:
            print(f"Skipping {p_id} (v{p_version}): Version match in plugins.json")
            continue
            
        print(f"Building {p_id} (v{p_version}) - New version detected!")
        build_result = build_plugin(p_dir, DIST_DIR)
        if not build_result:
            continue
            
        filename = build_result["filename"]
        
        # Define Tag and Release Name
        # Tag format: {plugin_id}/v{version} (e.g. com.example.plugin/v1.0.0)
        # This namespaces the tags so multiple plugins can have v1.0.0 without conflict
        tag_name = f"{p_id}/v{p_version}"
        release_name = f"{p_name} v{p_version}"
        
        # Download URL points to this specific tag's asset
        download_url = f"https://github.com/{REPO_NAME}/releases/download/{tag_name}/{filename}"
        
        releases_to_create.append({
            "tag_name": tag_name,
            "release_name": release_name,
            "body": f"Release for {p_name} version {p_version}",
            "files": [f"dist/{filename}"]
        })
        
        entry = existing_plugins_map.get(p_id, {})
        
        # Update fields from manifest
        entry["id"] = p_id
        entry["name"] = p_name
        entry["version"] = p_version
        entry["description"] = manifest.get("description", entry.get("description"))
        entry["author"] = manifest.get("author", entry.get("author"))
        entry["icon"] = manifest.get("icon", entry.get("icon"))
        entry["category"] = manifest.get("category", entry.get("category", "utility"))
        entry["downloadUrl"] = download_url
        
        existing_plugins_map[p_id] = entry
        updated_count += 1
        
    if updated_count == 0:
        print("No plugin updates detected. Exiting.")
        if "GITHUB_OUTPUT" in os.environ:
             with open(os.environ["GITHUB_OUTPUT"], "a") as f:
                f.write("should_release=false\n")
        return

    # Reconstruct plugins list
    plugins_data["plugins"] = list(existing_plugins_map.values())
    save_plugins_json(plugins_data)
    
    print(f"Updated plugins.json with {updated_count} plugins.")
    
    # Save release metadata to a JSON file for the workflow to consume
    with open("releases_to_create.json", "w", encoding="utf-8") as f:
        json.dump(releases_to_create, f)
    
    # Export release flag for GitHub Actions
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write("should_release=true\n")

if __name__ == "__main__":
    main()
