# Azure cutover ticket alignment

Ticket: [#184](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/184).
Plan: [Spec#180](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/180),
with HRMS staying on Vercel under
[Spec#222](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/222).

## Changes verified on 2026-11-09

| Ticket | Result |
| --- | --- |
| [#146](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/146) | Confirmed unchanged: CREOMS reads `PORTAL_URL` from Azure Container Apps and fixes the GitHub deploy secret if needed. HRMS is excluded. |
| [#161](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/161) | Confirmed unchanged: Portal and CREOMS gateway configuration uses Azure and GitHub deploy secrets. Ecommerce uses #198; HRMS uses #218. |
| [#163](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/163) | Replaced the obsolete ecommerce Vercel instructions with a supersession notice and closed as not planned. Replacement: #198, ecommerce cutover check, coordinated with gateway cutover #160/#161. The notice keeps the Cloudflare gateway until cutover and names the Azure settings and deploy secrets to update. |
| [#164](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/164) | Corrected step 1: check Azure Container Apps environment variables and GitHub deploy secrets for Portal, ecommerce and CREOMS; check Vercel settings only for HRMS. Existing retirement instructions and HRMS project/callback protection are preserved. |

Each of the four tickets has a comment linking Spec#180. All four titles are
preserved. The bodies of #146 and #161 are unchanged. #138 is untouched.
Remaining Vercel references in these open tickets describe HRMS, the unavailable
old Portal, or retirement of old hosts; none instructs the owner to deploy or
configure ecommerce or CREOMS on Vercel.

## Verification

Read each current issue with `gh issue view` before editing, then fetched each
again after editing. Compared titles against the original snapshots, confirmed
#146/#161 bodies were unchanged, checked that #163 is closed and links #198,
and confirmed #164 retains the old `hrms-arae` project and callback protection.
Checked each ticket for its Spec#180 comment and compared #138's body and title
with its original snapshot.

This is issue maintenance with a repository verification note. There is no
application behavior change, new test seam, or database migration. Existing
repository checks and the PR container smoke workflow cover the unchanged app;
the main workflow also verifies the deployed revision and public health route.
The human cutover and retirement tickets remain open for their owners.
