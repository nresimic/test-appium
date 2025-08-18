const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

let cachedCredentials = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCredentialsFromParameterStore = async () => {
  // Check if cache is still valid (within 5 minutes)
  const now = Date.now();
  if (cachedCredentials && cacheTime && (now - cacheTime) < CACHE_DURATION) {
    return cachedCredentials;
  }
  
  console.log('Fetching fresh credentials from Parameter Store...');
  
  const ssmClient = new SSMClient({ region: 'eu-west-1' });
  
  const command = new GetParametersCommand({
    Names: [
      '/vault22/aws/access-key-id',
      '/vault22/aws/secret-access-key', 
      '/vault22/aws/session-token'
    ],
    WithDecryption: true
  });
  
  const response = await ssmClient.send(command);
  const params = response.Parameters || [];
  
  if (params.length !== 3) {
    throw new Error(`Expected 3 parameters, got ${params.length}. Missing parameters in Parameter Store.`);
  }
  
  cachedCredentials = {
    accessKeyId: params.find(p => p.Name === '/vault22/aws/access-key-id')?.Value,
    secretAccessKey: params.find(p => p.Name === '/vault22/aws/secret-access-key')?.Value,
    sessionToken: params.find(p => p.Name === '/vault22/aws/session-token')?.Value
  };
  
  cacheTime = now;
  console.log('Successfully cached fresh credentials');
  
  return cachedCredentials;
};

module.exports = { getCredentialsFromParameterStore };