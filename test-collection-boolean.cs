using ConfigurationManager.Client;
using ConfigurationManager.Client.Exceptions;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

class CollectionBooleanTest
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
            
            // Test the boolean collection validation
            Console.WriteLine("\n=== TESTING BOOLEAN COLLECTION VALIDATION ===");
            
            string configName = "FitnessWatch Pro - Sports Edition";
            string testPath = "Display.screen.colorDepth"; // This should have a collection rule with "true, false"
            
            try
            {
                Console.WriteLine($"Testing path: {testPath}");
                
                // Test with minimal=true to get simple value
                var response = await client.Configurations.GetConfigurationValueByNameAsync(
                    configName, testPath, minimal: true);
                
                Console.WriteLine($"✅ Successfully retrieved value");
                Console.WriteLine($"   ValueKind: {response.Value.ValueKind}");
                
                var actualValue = ExtractJsonElementValue(response.Value);
                Console.WriteLine($"   Actual value: {actualValue}");
                Console.WriteLine($"   Value type: {actualValue?.GetType().Name ?? "null"}");
                
                // If it's a string "24bit", that means no collection rule OR rule validation is working
                // If it's a boolean, that might indicate the issue still exists
                if (actualValue is bool boolValue)
                {
                    Console.WriteLine($"⚠️  Got boolean value: {boolValue}");
                    Console.WriteLine("   This might indicate the collection rule conversion issue still exists");
                }
                else if (actualValue is string stringValue)
                {
                    Console.WriteLine($"✅ Got string value: '{stringValue}'");
                    Console.WriteLine("   This is correct - no boolean conversion happened");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error testing path: {ex.Message}");
            }
            
            // Test different configurations with various data types
            var testConfigs = new[]
            {
                ("Tools", ""),                      // Full config
                ("Battery", ""),                    // Full config
                ("Display", ""),                    // Full config (component)
            };
            
            foreach (var (configName2, pathSuffix) in testConfigs)
            {
                Console.WriteLine($"\n=== TESTING CONFIG: {configName2} ===");
                try
                {
                    var response = await client.Configurations.GetConfigurationValueByNameAsync(
                        configName2, minimal: true);
                    
                    Console.WriteLine($"✅ Retrieved: {configName2}");
                    var value = ExtractJsonElementValue(response.Value);
                    
                    if (value is JsonElement jsonElement)
                    {
                        Console.WriteLine($"   Type: {jsonElement.ValueKind}");
                        if (jsonElement.ValueKind == JsonValueKind.Object)
                        {
                            var props = jsonElement.EnumerateObject().Take(3).ToList();
                            Console.WriteLine($"   Sample properties: {string.Join(", ", props.Select(p => p.Name))}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"   Direct value: {value} ({value?.GetType().Name})");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Error with {configName2}: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Test error: {ex.Message}");
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
            JsonValueKind.Object => element, // Return the JsonElement for objects to preserve structure
            JsonValueKind.Undefined => null,
            _ => element.GetRawText()
        };
    }
}
