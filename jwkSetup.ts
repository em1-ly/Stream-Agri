import { generateKeyPair, exportSPKI, exportPKCS8, importSPKI, exportJWK } from 'jose';
import * as SecureStore from 'expo-secure-store';


export const generateRSAKeysAndJWK = async () => {
    try {
      // Generate RSA key pair
      const { publicKey, privateKey } = await generateKeyPair('RS256', {
        modulusLength: 2048,
      });
      
      // Export private key for JWT signing
      const privateKeyPEM = await exportPKCS8(privateKey);
      
      // Export public key as JWK (matching PowerSync format)
      const jwk = await exportJWK(publicKey);
      
      // Add required fields to match PowerSync format
      const powerSyncJWK = {
        kty: jwk.kty,           // "RSA"
        n: jwk.n,               // The modulus
        e: jwk.e,               // The exponent (usually "AQAB")
        alg: "RS256",           // Algorithm
        kid: "rn-powersync-2024" // Your key ID
      };
      
      // Store private key for token generation
      await SecureStore.setItemAsync('powersync_private_key', privateKeyPEM);
      
      // Store JWK for easy access
      await SecureStore.setItemAsync('powersync_jwk', JSON.stringify(powerSyncJWK));
      
      console.log('Generated JWK (copy this to your API route):');
      console.log(JSON.stringify({ keys: [powerSyncJWK] }, null, 2));
      
      return { privateKeyPEM, jwk: powerSyncJWK };
    } catch (error) {
      console.error('Key generation failed:', error);
      throw error;
    }
};




export const getPublicKeyJWK = async () => {
  try {
    const publicKeyPEM = await SecureStore.getItemAsync('powersync_public_key');
    if (!publicKeyPEM) {
      throw new Error('Public key not found');
    }
    
    // Import the public key
    const publicKey = await importSPKI(publicKeyPEM, 'RS256');
    
    // Convert to JWK
    const jwk = await exportJWK(publicKey);
    
    // Add required fields
    jwk.kid = 'rn-key-2024'; // Your key ID
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    
    return jwk;
  } catch (error) {
    console.error('JWK conversion failed:', error);
    throw error;
  }
};