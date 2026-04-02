import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

const config = [...coreWebVitals, ...typescriptConfig];

export default config;
