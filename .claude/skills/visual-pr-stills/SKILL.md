---
name: visual-pr-stills
description: A PR that changes what the player sees does not merge without before/after stills in its body, taken at the fight camera at 375 wide, ready idle plus mid-fight, and the reviewer's verdict on them. Lead enforces at READY; Deploy refuses to merge without them. Web, World, Armour, Hero Look, Weapons, Finishers, Character lanes.
---

# Visual PRs need stills before merge

#537 (fighter rim and key lighting) merged and went live without stills. Dom saw it live first: "white outlines, shiny not gritty". Every look change since ships stills first.

## What the PR body must carry
- BEFORE and AFTER at the fight camera, 375 wide (phone), both fighters in frame: ready idle and one mid-fight frame. Desktop 1280 too when the change touches layout.
- For a rank look: the in-game sheet front and back at 375, plus the gz size and the built-app delta.
- One line from the lane on what changed and what to look for.
- Lead's verdict on the stills, or Dom's word when he judged them.

## Where the stills come from
- The repo's harness scripts (arena-preview, character-preview, armour-contact-sheet), not a screenshot of a dev server.
- Single-browser captures are exempt from the deploy-lock hold; a full contact-sheet run is not.
- Stills go in the PR body as images or in `artifacts/<lane>/` with the path in the body, never as scratch files elsewhere in the repo.

## Refusals
- Lead does not mark READY without them.
- Deploy does not merge a look PR whose body has none, even when CI is green.
- "It is a small tweak" is not an exemption; the rim chip was a small tweak.
