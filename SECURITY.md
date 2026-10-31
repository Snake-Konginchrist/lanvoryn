# Security

**English** · [简体中文](SECURITY.zh-CN.md)

Use private vulnerability reporting on the hosting platform when available. Do not publish passwords, cookies, full SDP or identifying device information in public issues.

Keep raw MediaMTX publishing, signaling and management interfaces loopback-only. Exposing or separately proxying ports 8554, 8889 or 9997 can bypass the intended application boundary.

Password authentication is not HTTP encryption. Use HTTPS and Secure cookies on shared or untrusted networks. This is a single-instance local-account application, without multi-tenant isolation or distributed session storage.

The host OS and its local users are trusted. Users able to read credential files or access internal loopback services are outside the isolation boundary. Revoking an online session cannot recall previously downloaded snapshots or recordings.
