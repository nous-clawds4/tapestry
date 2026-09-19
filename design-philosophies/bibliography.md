# Bibliography

The writing that the design philosophies draw on, with links that work. Most of it is the owner’s own: many ideas in this project were worked out in public, in long-form nostr articles, before they were code.

**If you are an agent looking for the source of an idea, start here.** If the piece you want is not listed, the wider public bibliography — Substack essays, repositories, podcasts and talks — is [Pretty-Good-Freedom-Tech/brainstorm-references](https://github.com/Pretty-Good-Freedom-Tech/brainstorm-references) (`references.md`).

## How a source is cited

A nostr long-form article is an addressable event, so its durable identifier is its **coordinate**, `30023:<author pubkey>:<d-tag>`. Links are conveniences that can rot; the coordinate cannot. Every entry below gives both.

- **Author:** straycat (the owner — see the [README](./README.md)) — `e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f` (npub1u5njm6g5h5cpw4wy8xugu62e5s7f6fnysv0sj0z3a8rengt2zqhsxrldq3)
- **Kind:** 30023
- **Link form:** `https://njump.me/<naddr>`, where the naddr encodes kind + author + d-tag with no relay hints. Any nostr client will resolve the same naddr if the gateway is gone.
- To build a link for an article that is not listed yet: `nip19.naddrEncode({ kind: 30023, pubkey, identifier: dTag })` with the repo’s own `nostr-tools`, then open it and check the title before citing it.

Every link below was opened and its title checked on 2026-09-19.

## Cited by a design philosophy

<a id="show-and-tell"></a>

### To get Web of Trust right, we must Show AND Tell

straycat, 2024-08-22 · coordinate `30023:e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f:1724346231852` · [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxnzdejxsengd3jxvcnsdfjwdr03d)

Cited by [Show and Tell](./show-and-tell.md). Written after the web-of-trust panel at Nostriga. It argues that trust can be communicated two ways — you can show it through what you do (follows, mutes, zaps: “proxy indicators”) or tell it outright (“explicit trust attestations”) — that these are two ends of a spectrum, and that a good trust calculation pools both. It predicts that as scores built on Show data start to matter, people will game them, and the weight will drift toward Tell. The design philosophy widens the same idea from trust in people to the curation of any data.

## All long-form articles by straycat

Newest first. “Last revised” is the date of the current version of the event; where the d-tag is a number it is the millisecond timestamp of the first draft.

| Title | Last revised | d-tag | Link |
|---|---|---|---|
| Web of Trust: Where is the Trust Signal? | 2025-12-14 | `web-of-trust-where-is-the-trust-signal` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqn8wetz94hkvtt5wf6hxapdwa5x2un9945hxtt5dpjj6arjw4ehgttnd9nkuctv378l06) |
| Why GrapeRank Uses Mutes and Reports to Pick Off Bots, Impersonators and Bad Actors | 2025-11-28 | `why-graperank-uses-mutes-and-reports-to-pick-off-bots-impersonators-and-bad-actors` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qpf8w6re94nhyctsv4exzmnt946hxetn94kh2ar9wvkkzmny94ex2ur0wf68xtt5dukhq6trdvkk7enx943x7arn945k6ur9wfek7mnpw3hhyuedv9hxgttzv9jz6ctrw3hhyuc76gy7k) |
| Data Model for a Neo4j Nostr Relay | 2025-11-28 | `data-model-for-a-neo4j-nostr-relay` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qq3xgct5vykk6mmyv4kz6en0wgkkzttwv4hng63ddehhxarj94ex2mrp0y7z9742) |
| Standardization of Trust Metric Delivery Protocols | 2025-11-27 | `standardization-of-trust-metric-delivery-protocols` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqe8xarpdejxzunyd9axzarfdahz6mmx9468yatnwskk6et5wf5kxttyv4kxjan9wfuj6urjda6x7cm0d3espuqd0l) |
| Key Rotation and Web of Trust: the Simplest Possible Solution to a Pressing Problem | 2025-11-14 | `key-rotation-and-web-of-trust-the-simplest-possible-solution-to-a-pressing-problem` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qpfxkete94ex7arpw35k7m3dv9hxgtthv43z6mmx9468yatnwskhg6r994ekjmtsd3jhxapdwphhxumfvfkx2ttndak82arfdahz6ar094sj6urjv4ehx6twvukhqun0vfkx2mgq96ve3) |
| Separation of Trust and Client | 2025-11-09 | `separation-of-trust-and-client` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qq08xetsv9exzarfdahz6mmx9468yatnwskkzmny943kc6t9de6q76t2la) |
| Decentralized Curation of Simple Lists | 2025-10-29 | `decentralized-curation-of-simple-lists` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqnxgetrv4h8gunpd35h5ety943h2unpw35k7m3ddanz6umfd4cxcefdd35hxarnp8nkfg) |
| Community Curation of Custom NIPs | 2025-10-28 | `community-curation-of-custom-nips` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqskxmmdd46ku6t50ykkxatjv96xjmmw94hkvttrw4ehgmmd94hxjurnxdq2np) |
| Service Providers for Personalized Trust Metrics | 2025-10-13 | `service-providers-for-personalized-trust-metrics` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqc8xetjwe5kxefdwpex7anfv3jhyuedvehhyttsv4e8xmmwv9kxj7n9vskhgun4wd6z6mt9w3exjcmndvv270) |
| GrapeRank | 2025-10-13 | `graperank` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqykwunpwpjhyctwdvhjgms7) |
| Integration of NIP-85: Trusted Assertions into Nostr Clients | 2025-09-27 | `integration-of-nip-85-trusted-assertions-into-nostr-clients` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqakjmn5v4nhyct5d9hkutt0vckku6ts95ur2tt5wf6hxar9vskkzumnv4e8g6t0deej66tww3hj6mn0wd68yttrd35k2mn5wvptta4l) |
| The Grapevine Worldview: under the hood with your web of trust | 2024-09-10 | `1725143095938` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxnzdejx5cngves8y6njvecy87amm) |
| Web of Trust, the Grapevine and the Art of Interpretation | 2024-09-08 | `1725818480445` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxnzdejx5urzwp58qcrgdp4dutxqa) |
| The GrapeRank Equation: Notation and Terminology | 2024-08-31 | `1725006462512` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxnzdejx5crqd35xcer2vfjzk7hzn) |
| To get Web of Trust right, we must Show AND Tell | 2024-08-22 | `1724346231852` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxnzdejxsengd3jxvcnsdfjwdr03d) |
| Web of trust: a roadmap for the short to medium term | 2024-05-19 | `1700273037542` | [read](https://njump.me/naddr1qvzqqqr4gupzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxnzdesxqerwvesxvmn2dpj5hl046) |

## Adding a source

Add a row to the table (or a new section for a different author or medium), and — if a philosophy cites it — a short entry under “Cited by a design philosophy” with an anchor the philosophy can link to. Say in a sentence or two what the piece argues; the reader may not be able to open the link.
