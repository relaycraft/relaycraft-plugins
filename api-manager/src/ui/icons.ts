/* eslint-disable @typescript-eslint/no-explicit-any */
function pickIcon(hostIcons: Record<string, any> | undefined, name: string) {
  const candidate = hostIcons?.[name];
  return candidate && (typeof candidate === "function" || typeof candidate === "object") ? candidate : null;
}

function pickFirstIcon(hostIcons: Record<string, any> | undefined, names: string[]) {
  for (const name of names) {
    const icon = pickIcon(hostIcons, name);
    if (icon) return icon;
  }
  return null;
}

export function createIcons(_el: (...args: any[]) => any, hostIcons?: Record<string, any>) {
  return {
    BookOpen: pickIcon(hostIcons, "BookOpen"),
    Plus: pickIcon(hostIcons, "Plus"),
    Folder: pickIcon(hostIcons, "Folder"),
    File: pickIcon(hostIcons, "File"),
    FilePlus: pickFirstIcon(hostIcons, ["FilePlus", "FilePlus2", "SquarePlus"]),
    Link: pickIcon(hostIcons, "Link"),
    Trash: pickFirstIcon(hostIcons, ["Trash2", "Trash"]),
    Settings: pickIcon(hostIcons, "Settings"),
    Search: pickIcon(hostIcons, "Search"),
    Check: pickFirstIcon(hostIcons, ["Check", "CheckCheck", "CheckCircle2"]),
    CheckCircle: pickFirstIcon(hostIcons, ["CheckCircle2", "CheckCircle", "Check"]),
    Circle: pickIcon(hostIcons, "Circle"),
    X: pickFirstIcon(hostIcons, ["X", "XCircle", "Eraser"]),
    Copy: pickFirstIcon(hostIcons, ["Copy", "CopyPlus", "Files"]),
    Send: pickFirstIcon(hostIcons, ["Send", "SendHorizontal", "ArrowUpRight"]),
    History: pickFirstIcon(hostIcons, ["History", "Clock3", "Clock"]),
    Code: pickFirstIcon(hostIcons, ["Code2", "Code", "Braces"]),
    Terminal: pickFirstIcon(hostIcons, ["Terminal", "SquareTerminal", "Command"]),
    Play: pickFirstIcon(hostIcons, ["Play", "PlayCircle", "Triangle"]),
    Square: pickFirstIcon(hostIcons, ["Square", "StopCircle", "CircleStop"]),
    Bookmark: pickFirstIcon(hostIcons, ["Bookmark", "BookmarkCheck"]),
    Pin: pickFirstIcon(hostIcons, ["Pin", "Bookmark", "Star"]),
    PinOff: pickFirstIcon(hostIcons, ["PinOff", "BookmarkX", "StarOff"]),
    FolderInput: pickFirstIcon(hostIcons, ["FolderInput", "FolderSymlink", "CornerRightDown"]),
    FolderPlus: pickFirstIcon(hostIcons, ["FolderPlus", "FolderAdd"]),
    ChevronRight: pickFirstIcon(hostIcons, ["ChevronRight", "ArrowRight"]),
    ChevronDown: pickFirstIcon(hostIcons, ["ChevronDown", "ArrowDown"]),
    GripVertical: pickFirstIcon(hostIcons, ["GripVertical", "Grip", "GripHorizontal"]),
    MoreHorizontal: pickFirstIcon(hostIcons, ["MoreHorizontal", "Ellipsis", "EllipsisVertical"]),
  };
}
