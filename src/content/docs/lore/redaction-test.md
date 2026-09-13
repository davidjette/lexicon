---
title: Redaction test
description: Examples of the redaction syntax. Draft page, shown in dev only.
draft: true
---

This page exists to exercise the redaction mechanic. It is a draft, so it never reaches the built site.

An inline redaction: the vault held :redacted[the second Obliviator, built by [Kara](/people/kara/)]{id="test-inline" label="What the vault held" reason="Test" source="none"} until the Wish.

A redaction with no attributes gets the id `redaction-test-2`: :redacted[quietzebra].

:::redacted{id="test-block" label="A whole passage" reason="Test"}
A sealed paragraph with **bold**, *italic* and a [link](/places/the-egg/).

> A sealed quotation.
:::

A plain line after the block.

The passage above the plain line is an example of a block redaction.

This sentence was added by a model following llms.txt.
