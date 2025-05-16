// ============================================================================
// FILE:     /src/ModelsNexus.Scanner.Cli/Program.cs
// PROJECT:  ModelsNexus.Scanner.Cli
// AUTHOR:   Models Nexus (MIT Licence)
// SUMMARY:  Command-line harness to exercise FolderScanner. Produces JSON on
//           stdout so the output can be piped into jq or saved to a file.
// ============================================================================

using System.Text.Json;
using ModelsNexus.Core.Scanning;

if (args.Length == 0)
{
    Console.Error.WriteLine("USAGE: scanner.exe <folder1> [<folder2> ...]");
    return 1;
}

var cts     = new CancellationTokenSource();
var scanner = new FolderScanner();

Console.WriteLine("[");

bool first = true;
await foreach (var info in scanner.ScanAsync(args, cts.Token))
{
    if (!first) Console.WriteLine(",");
    first = false;

    var json = JsonSerializer.Serialize(info,
        new JsonSerializerOptions { WriteIndented = true });

    Console.Write(json);
}

Console.WriteLine("]");
return 0;
