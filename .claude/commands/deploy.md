Run the ChristConnect production deploy sequence. Execute both commands in order and report success or failure after each step.

Step 1 — build the web export:
```
NODE_OPTIONS=--use-system-ca npx expo export --platform web
```

Step 2 — copy assets and deploy to Vercel production:
```
rm -rf uniconnect-platform/_expo uniconnect-platform/index.html uniconnect-platform/favicon.ico uniconnect-platform/assets uniconnect-platform/metadata.json && cp -r dist/* uniconnect-platform/ && cd uniconnect-platform && npx vercel --prod --yes
```

After both commands complete, confirm the Production URL is live at https://uniconnect-platform-gamma.vercel.app.
