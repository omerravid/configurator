using ConfigurationManager.Client;
using ConfigurationManager.Client.Exceptions;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Web;

class SpaceDebugTest
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
            
            // Test configurations with and without spaces
            var testConfigs = new[]
            {
                "Tools",                                    // No spaces - should work
                "Battery",                                  // No spaces - should work  
                "SmartWatch Lite - Everyday Use",         // Has spaces - might fail
                "FitnessWatch Pro - Sports Edition",      // Has spaces - might fail
                "SmartWatch Lite",                         // Has spaces - might fail
                "FitnessWatch Pro"                         // Has spaces - might fail
            };
            
            foreach (var configName in testConfigs)
            {
                Console.WriteLine($"\n=== TESTING: '{configName}' ===");
                Console.WriteLine($"Name length: {configName.Length}");
                Console.WriteLine($"Has spaces: {configName.Contains(' ')}");
                Console.WriteLine($"URL encoded: {Uri.EscapeDataString(configName)}");
                
                try
                {
                    var response = await client.Configurations.GetConfigurationValueByNameAsync(
                        configName, minimal: true);
                    
                    Console.WriteLine($"✅ SUCCESS - Found configuration: {configName}");
                    Console.WriteLine($"   Response type: {response.Value.ValueKind}");
                }
                catch (NotFoundException ex)
                {
                    Console.WriteLine($"❌ NOT FOUND - {configName}: {ex.Message}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"💥 ERROR - {configName}: {ex.Message}");
                }
            }
            
            // Try with specific path on a config with spaces
            Console.WriteLine($"\n=== TESTING PATH ON CONFIG WITH SPACES ===");
            try
            {
                var pathResponse = await client.Configurations.GetConfigurationValueByNameAsync(
                    "FitnessWatch Pro - Sports Edition", 
                    "Display.screen.colorDepth", 
                    minimal: true);
                
                Console.WriteLine($"✅ SUCCESS - Path access worked");
                var value = ExtractJsonElementValue(pathResponse.Value);
                Console.WriteLine($"   Value: {value}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ FAILED - Path access: {ex.Message}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Test error: {ex.Message}");
        }
        
        Console.WriteLine("\nPress any key to exit...");
        Console.ReadKey();
    }

    static object? ExtractJsonElementValue(System.Text.Json.JsonElement element)
    {
        return element.ValueKind switch
        {
            System.Text.Json.JsonValueKind.String => element.GetString(),
            System.Text.Json.JsonValueKind.Number => element.TryGetInt32(out var intVal) ? intVal : element.GetDouble(),
            System.Text.Json.JsonValueKind.True => true,
            System.Text.Json.JsonValueKind.False => false,
            System.Text.Json.JsonValueKind.Null => null,
            System.Text.Json.JsonValueKind.Array => element.EnumerateArray().Select(e => ExtractJsonElementValue(e)).ToArray(),
            System.Text.Json.JsonValueKind.Object => element.GetRawText(),
            System.Text.Json.JsonValueKind.Undefined => null,
            _ => element.GetRawText()
        };
    }
}
