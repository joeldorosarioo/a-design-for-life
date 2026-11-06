import { expect, it } from 'vitest';
import { readLocalEditorCredentials } from './provision-local-editor';

const environment = {
  APP_ENV: 'local',
  LOCAL_EDITOR_EMAIL: 'editor@example.invalid',
  LOCAL_EDITOR_PASSWORD: 'Synthetic-local-editor-password-123!',
};

it('accepts private local credentials and normalizes the native email identity', () => {
  expect(
    readLocalEditorCredentials({ ...environment, LOCAL_EDITOR_EMAIL: 'Editor@Example.Invalid' }),
  ).toEqual({ email: environment.LOCAL_EDITOR_EMAIL, password: environment.LOCAL_EDITOR_PASSWORD });
});

it.each(['test', 'staging', 'production', undefined])(
  'refuses account provisioning for APP_ENV=%s before application initialization',
  (APP_ENV) => {
    expect(() => readLocalEditorCredentials({ ...environment, APP_ENV })).toThrow(/APP_ENV=local/);
  },
);

it.each([
  { LOCAL_EDITOR_EMAIL: undefined },
  { LOCAL_EDITOR_EMAIL: 'invalid' },
  { LOCAL_EDITOR_PASSWORD: undefined },
  { LOCAL_EDITOR_PASSWORD: '' },
])('refuses missing or invalid private inputs without echoing the values', (invalid) => {
  expect(() => readLocalEditorCredentials({ ...environment, ...invalid })).toThrow(
    /^Local editor provisioning requires APP_ENV=local and private LOCAL_EDITOR_EMAIL\/LOCAL_EDITOR_PASSWORD\.$/,
  );
});
