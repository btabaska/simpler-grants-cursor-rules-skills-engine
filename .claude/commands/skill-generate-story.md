# Generate Story

Generate a Storybook CSF3 story for a component.

## What I Need From You

- Component path.
- Optional state subset: `default,loading,error,empty,long-content,rtl`.

## What Happens Next

1. Reads props and nearest sibling story conventions.
2. Generates a CSF3 file with the requested states.
3. Pulls mock data from existing factories or prompts to generate one.
4. Writes the file next to the component.

## Tips

- Always include `error` and `empty` for data components.
- Add `rtl` for i18n-facing components.
- Follow up with `/skill-accessibility-check` on the story variants.
