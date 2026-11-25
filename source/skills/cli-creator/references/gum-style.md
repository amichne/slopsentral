# `gum style` | Emphasize a status

Use a short label that describes the state even without color. Borders and padding occupy terminal cells. Reserve them for a human-facing display.

```sh
gum style --bold --border normal --padding '0 1' -- 'Build passed'
```

Keep decoration out of serialized results. If the status accompanies a data stream, send the label to stderr. Check the longest label at the narrowest supported width.
