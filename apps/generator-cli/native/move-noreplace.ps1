param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Source,
    [Parameter(Mandatory = $true, Position = 1)]
    [string] $Destination
)

$ErrorActionPreference = "Stop"

try {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class ObbyMoveNoReplace
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool MoveFile(string existingPath, string newPath);
}
"@

    if ([ObbyMoveNoReplace]::MoveFile($Source, $Destination)) {
        exit 0
    }

    try {
        Get-Item -LiteralPath $Destination -Force -ErrorAction Stop | Out-Null
        exit 10
    }
    catch {
        exit 30
    }
}
catch {
    exit 20
}
