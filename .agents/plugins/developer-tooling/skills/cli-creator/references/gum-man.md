# `gum man` | Generate the manual

Use this packaging command to generate the section 1 manual that matches the Gum executable. The output is roff source suitable for a manual-page package.

```sh
gum man > gum.1 || exit "$?"
man ./gum.1
```

Use an empty staging directory for generation. To preview the result, pass the local path to `man`. For packaging alone, distribute the generated gum.1 through the existing manual directory.
