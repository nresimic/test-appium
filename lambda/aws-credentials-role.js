const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');

let cachedCredentials = null;
let cacheTime = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (session tokens last ~1 hour)

const CROSS_ACCOUNT_ROLE_ARN = process.env.VAULT22_ROLE_ARN || 'arn:aws:iam::859998284317:role/testpolicy';

const getCredentialsFromRole = async () => {
  // Check if cache is still valid (within 15 minutes)
  const now = Date.now();
  if (cachedCredentials && cacheTime && (now - cacheTime) < CACHE_DURATION) {
    return cachedCredentials;
  }
  
  console.log('Assuming cross-account role for AWS services...');
  
  const stsClient = new STSClient({ region: 'eu-west-1' });
  
  const command = new AssumeRoleCommand({
    RoleArn: CROSS_ACCOUNT_ROLE_ARN,
    RoleSessionName: 'vault22-lambda-session',
    DurationSeconds: 3600 // 1 hour
  });
  
  const response = await stsClient.send(command);
  const credentials = response.Credentials;
  
  if (!credentials) {
    throw new Error('Failed to assume role - no credentials returned');
  }
  
  cachedCredentials = {
    accessKeyId: credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken
  };
  
  cacheTime = now;
  console.log('Successfully assumed role and cached credentials');
  
  return cachedCredentials;
};

module.exports = { getCredentialsFromRole };