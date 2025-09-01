using ConfigurationManager.Client;
using ConfigurationManager.Client.Exceptions;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

class DebugProgram
{
    static async Task Main(string[] args)
    {
        string baseUrl = "http://172.23.0.1:3002/api";
        string username = "admin";
        string password = "admin123";
        
        try
        {
            using var client = ConfigurationManagerClientFactory.CreateForLogin(baseUrl);
            
            // Login
            Console.WriteLine("=== LOGIN ===");
            var authResponse = await client.Auth.LoginAsync(username, password);
            Console.WriteLine($"✓ Logged in as: {authResponse.User.Username}");
            Console.WriteLine($"✓ Token length: {authResponse.Token?.Length ?? 0}");
            
            // Test different paths to see what we get
            string configName = "Tools";
            
            var testPaths = new[]
            {
                "ScrewInserter.220002.ScrewInserterParams.ToolType",
                "ScrewInserter.220002.ScrewInserterParams", 
                "ScrewInserter.220002",
                "ScrewInserter"
            };
            
            foreach (var testPath in testPaths)
            {
                Console.WriteLine($"\n=== TESTING PATH: {testPath} ===");
                
                try
                {
                    // Test with minimal=true
                    Console.WriteLine($"Getting minimal response for path: {testPath}");
                    var minimalResponse = await client.Configurations.GetConfigurationValueByNameAsync(
                        configName, testPath, minimal: true);
                    
                    Console.WriteLine($"Response received:");
                    Console.WriteLine($"  Value.ValueKind: {minimalResponse.Value.ValueKind}");
                    Console.WriteLine($"  Value.GetRawText(): '{minimalResponse.Value.GetRawText()}'");
                    
                    // Try to extract the value
                    var extractedValue = ExtractJsonElementValue(minimalResponse.Value);
                    Console.WriteLine($"  Extracted value: {extractedValue?.ToString() ?? "null"}");
                    Console.WriteLine($"  Extracted type: {extractedValue?.GetType().Name ?? "null"}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Error with path '{testPath}': {ex.Message}");
                }
            }
            
            // Also test getting the entire configuration
            Console.WriteLine($"\n=== TESTING ENTIRE CONFIG: {configName} ===");
            try
            {
                var fullConfig = await client.Configurations.GetConfigurationValueByNameAsync(
                    configName, minimal: true);
                
                Console.WriteLine($"Full config received:");
                Console.WriteLine($"  Value.ValueKind: {fullConfig.Value.ValueKind}");
                Console.WriteLine($"  Value.GetRawText() length: {fullConfig.Value.GetRawText()?.Length ?? 0}");
                
                if (fullConfig.Value.ValueKind == JsonValueKind.Object)
                {
                    Console.WriteLine("  Available properties:");
                    foreach (var prop in fullConfig.Value.EnumerateObject())
                    {
                        Console.WriteLine($"    - {prop.Name}: {prop.Value.ValueKind}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error getting full config: {ex.Message}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Unexpected error: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
        }
        
        Console.WriteLine("\nPress any key to exit...");
        Console.ReadKey();
    }

    static object? ExtractJsonElementValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt32(out var intVal) ? intVal : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            JsonValueKind.Array => element.EnumerateArray().Select(e => ExtractJsonElementValue(e)).ToArray(),
            JsonValueKind.Object => element.GetRawText(),
            JsonValueKind.Undefined => null,
            _ => element.GetRawText()
        };
    }
}
