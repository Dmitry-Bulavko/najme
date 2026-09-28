import { baseConfig } from '@najme/config/eslint';
import nextConfig from 'eslint-config-next';

export default [...baseConfig, ...nextConfig, { ignores: ['.next/**'] }];
