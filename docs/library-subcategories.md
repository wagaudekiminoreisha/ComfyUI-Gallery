# Browsing tag subcategories

Open **Prompts & prefixes → Tags**, then use **All tag categories and subcategories**. Expand a parent such as Attire or Pose, or search for a child such as Tops, Motion or Weather. Check multiple children to combine their tags. Checking a parent includes its entire vocabulary; leave the parent unchecked when selecting only particular children.

This is a vocabulary browser: it controls which tags are offered for addition to a prefix or encoder. The source-card category controls separately determine which incoming image tags contribute to that source. Both use the same curated category membership.

The existing **Wiki groups** selector remains an optional additional filter. Within either selector, multiple picks combine by union; between the two selectors, results are intersected. Text/alias search, favorites, order, pagination and **Select all matching** all operate on that same subset. For example, Tops + Bottoms combines those two categories, while adding the Attire wiki group further restricts the results to that wiki's vocabulary.

Counts beside category names describe the canonical offline vocabulary, independent of the current search. Categories can overlap and counts are not additive. Browseable names come from the pinned dictionary; unknown/custom tags remain available through existing manual entry. No prompts, source masks, global rules or saved libraries are changed by browsing or checking categories.

The API accepts an optional `refinements` array of category IDs on dictionary browse/selection requests and returns category metadata under the same key, including parent IDs and counts. Existing `category`/`categories` requests remain supported. Membership is cached once per server process from the shared source-filter catalogue, with names resolved through the dictionary's canonical alias map.
