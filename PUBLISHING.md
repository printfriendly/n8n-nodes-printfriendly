# Publishing

How to get `n8n-nodes-printfriendly` onto npm and into n8n. The first three steps happen once. After that, a release is one command.

## Before you start

- Use a Node 24 shell: `nvm install 24 && nvm use 24`. The toolchain does not build on older Node.
- The GitHub repository `printfriendly/n8n-nodes-printfriendly` must be **public** before the first tag is pushed. npm refuses provenance from a private repository, and n8n checks that the repository link in the npm package works.
- You need an npm account. The package name `n8n-nodes-printfriendly` is unscoped and free to claim.

## 1. First publish (once, from your machine)

Trusted publishing can only be set up for a package that already exists, so the first version goes up by hand. In a fresh clone, run `npm ci` first. The publish step lints and builds.

```sh
npm login
npm publish --access public
```

npm asks for a one-time code if your account uses 2FA. Add `--otp=<code>` if it does not ask.

This publishes `0.1.0` without provenance. That is expected. n8n will not verify this version. It only creates the package on npm.

## 2. Set up the trusted publisher (once)

1. Open the package on npmjs.com and go to **Settings**.
2. Under **Trusted Publisher**, choose **GitHub Actions**.
3. Fill in:
   - Organization or user: `printfriendly`
   - Repository: `n8n-nodes-printfriendly`
   - Workflow filename: `publish.yml`
   - Environment: leave blank
4. Save.

Optional: under **Publishing access**, choose **Require two-factor authentication and disallow tokens**. That closes the door on stolen tokens. It also turns off the `NPM_TOKEN` fallback in the workflow, which you do not need once trusted publishing works.

If you prefer a token, create a granular access token with read and write access to this package and store it as the repository secret `NPM_TOKEN`. The workflow uses it when it is set.

## 3. Release (every time)

Add the changes to `CHANGELOG.md` and commit them on `main`. Then, with a clean working tree:

```sh
npm version patch && git push --follow-tags
```

Use `minor` or `major` instead of `patch` when the change calls for it. `npm version` bumps `package.json` and `package-lock.json`, commits, and creates a tag such as `v0.1.1`. Pushing the tag starts `.github/workflows/publish.yml`. It checks that the tag matches `package.json`, installs, builds, runs the tests, and runs `npm publish --provenance --access public`.

Watch the run on the repository's **Actions** tab. When it is green, the package page on npmjs.com shows a provenance badge.

The first release after step 1 will be `0.1.1`. That is the first version n8n can verify.

If the run fails:

| Message | Cause |
| --- | --- |
| `Tag ... does not match package.json version` | The tag was made by hand. Use `npm version`, or delete the tag and make it again. |
| `E404` or `ENEEDAUTH` on publish | The trusted publisher is not set up, or the workflow filename or repository name does not match what you entered on npmjs.com. |
| Provenance error mentioning a private repository | The repository is not public yet. |

## 4. Scan the package

After the first workflow release, run n8n's scanner against the published package:

```sh
npx @n8n/scan-community-package n8n-nodes-printfriendly
```

The scanner takes a package name from the npm registry, not a local file. It checks the version's provenance, fetches the source from the public GitHub repository at the attested commit, and lints both the source and the published files. So it fails on `0.1.0` (no provenance) and on a private repository. Run it once `0.1.1` is live and the repository is public. It must pass before you submit.

Before that, `npm run lint` runs the same rules on the source.

## 5. Submit to n8n for verification

Verification is what makes the node appear in the nodes panel on n8n Cloud. It is optional for self-hosted users, who can install the package without it.

1. Sign up or log in to the n8n Creator Portal at https://creators.n8n.io/nodes.
2. Submit the package for verification. n8n fetches it from npm for final vetting. The form asks which npm package to verify. The n8n docs do not list the other fields, so read the form when you open it.

The requirements are on n8n's page, [Submit community nodes](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/), and in its [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/). Where this package stands:

| Requirement | Status |
| --- | --- |
| Name starts with `n8n-nodes-` | Yes |
| `n8n-community-node-package` keyword | Yes |
| MIT license | Yes |
| No runtime dependencies | Yes |
| No environment variable or file system access | Yes |
| English only | Yes |
| README with usage, examples and auth details | Yes |
| Built with the `n8n-node` CLI, lint passes | Yes |
| Published from GitHub Actions with provenance | Yes, from `0.1.1` |
| Public repository whose URL matches `package.json` | After the repository is made public |
| npm maintainer matches the repository owner | Check on npmjs.com that the maintainers are PrintFriendly accounts |
| One third-party service per package | Yes |

n8n reserves the right to reject nodes that compete with its paid features.
