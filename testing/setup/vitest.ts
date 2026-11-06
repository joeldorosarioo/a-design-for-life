import '@testing-library/jest-dom/vitest';

// Unit fixtures select their own bucket/database and internal HTTP behavior.
// Integration workers apply their exact namespace in a separate setup file.
delete process.env.MEDIA_STORAGE_ROOT;
delete process.env.INTERNAL_HTTP_ORIGIN;
