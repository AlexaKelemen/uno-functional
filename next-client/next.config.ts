import path from 'node:path'
import type { NextConfig } from 'next'

// The functional model (assignment 4) lives in ../src, outside this folder.
// The repository root is therefore the bundler's root, and @model/@utils
// (tsconfig paths) point into it, so the client uses the same model code as the server.
const repoRoot = path.join(__dirname, '..')

const nextConfig: NextConfig = {
  // We use the "classic" static/dynamic model from the lectures (static by
  // default, dynamic when a route uses params/cookies or forces it), so
  // Cache Components / Partial Prerendering stay off.
  cacheComponents: false,
  turbopack: {
    root: repoRoot,
  },
  outputFileTracingRoot: repoRoot,
}

export default nextConfig
