// Every club site uses the shared template unchanged. Don't add settings
// here: site settings live in content/settings/site.json, and template
// changes go into the site-template repo.
import { defineConfig } from 'astro/config';
import membero from '@membero/site-template';

export default defineConfig({ integrations: [membero()] });
