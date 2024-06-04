# hackfs

Ethereum File System (EFS) prototype for HackFS  
[https://ethglobal.com/showcase/ethereum-file-system-0t2m8](https://ethglobal.com/showcase/ethereum-file-system-0t2m8)

Browse and create onchain data for topics and users. Data is based on attestations from the Ethereum Attestation Service.

[View a pre-built version of the UI](https://efs-project.github.io/hackfs/)

Use "npm run dev" then open your browser to http://localhost:1234 (or whatever the output shows)

Things only really work on Sepolia right now due to schemas and such not being created on other chains yet.

This thing is super fragile so please be nice especially when using topics schemas (please don't duplicate the name of another subtopic as the schema has no validation yet)
