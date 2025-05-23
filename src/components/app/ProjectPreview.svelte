<!-- @migration task: review uses of `navigating` -->
<script lang="ts">
    import { navigating } from '$app/state';
    import Fonts from '@basis/Fonts';
    import type Chat from '@db/chats/ChatDatabase.svelte';
    import type Project from '@db/projects/Project';
    import { getFaceCSS } from '@output/outputToCSS';
    import { toStage } from '@output/Stage';
    import { EXCEPTION_SYMBOL, PHRASE_SYMBOL } from '@parser/Symbols';
    import Evaluator from '@runtime/Evaluator';
    import ExceptionValue from '@values/ExceptionValue';
    import { Chats, Creators, DB, locales } from '../../db/Database';
    import { isAudience, isFlagged } from '../../db/projects/Moderation';
    import UnicodeString from '../../unicode/UnicodeString';
    import { getUser } from '../project/Contexts';
    import CreatorView from './CreatorView.svelte';
    import Link from './Link.svelte';
    import Spinning from './Spinning.svelte';
    import type { Character } from '../../db/characters/Character';
    import { characterToSVG } from '../../db/characters/Character';
    import ConceptLink, { CharacterName } from '../../nodes/ConceptLink';
    import MarkupValue from '../../values/MarkupValue';
    import Value from '../../values/Value';
    import StructureValue from '@values/StructureValue';

    interface Props {
        project: Project;
        action?: (() => void) | undefined;
        /** Whether to show the project's name. */
        name?: boolean;
        /** How many rems the preview square should be. */
        size?: number;
        /** The link to go to when clicked. If none is provided, goes to the project. */
        link?: string | undefined;
        children?: import('svelte').Snippet;
        anonymize?: boolean;
        showCollaborators?: boolean;
    }

    function findCharacterName(value: Value): string | null {
        // If it's a MarkupValue, check for character links
        if (value instanceof MarkupValue) {
            const nodes = value.markup.nodes();
            for (const node of nodes) {
                if (node instanceof ConceptLink) {
                    const parsed = ConceptLink.parse(node.getName());
                    if (parsed instanceof CharacterName) {
                        return `${parsed.username}/${parsed.name}`;
                    }
                }
            }
        }

        // If it's a StructureValue, check all its fields recursively
        if (value instanceof StructureValue) {
            const bindings = value.context.getBindingsByNames();
            for (const [, fieldValue] of bindings) {
            const result = findCharacterName(fieldValue);
            if (result) return result;
            }
        }
        return null;
    }

    let {
        project,
        action = undefined,
        name = true,
        size = 6,
        link = undefined,
        children,
        anonymize = true,
        showCollaborators = false,
    }: Props = $props();

    // Clone the project and get its initial value, then stop the project's evaluator.
    type Preview = {
        representativeForeground: string | null;
        representativeBackground: string | null;
        representativeFace: string | null;
        representativeText: string;
        characterName: string | null;
    };

    /** Derive the preview contents from the project by getting it's first value */
    let {
        representativeForeground,
        representativeBackground,
        representativeFace,
        representativeText,
        characterName,
    }: Preview = $derived.by(() => {
        const evaluator = new Evaluator(
            project,
            DB,
            $locales.getLocales(),
            false,
        );
        const value = evaluator.getInitialValue();
        evaluator.stop();

        // First, check if there's a character name in the value
        const foundCharacterName = value ? findCharacterName(value) : null;
        
        if (foundCharacterName) {
            return {
                representativeForeground: null,
                representativeBackground: null,
                representativeFace: null,
                representativeText: '',
                characterName: foundCharacterName,
            };
        }

        // If no character found, proceed with regular representation
        const stage = value ? toStage(evaluator, value) : undefined;
        if (stage && stage.face) Fonts.loadFace(stage.face);

        return {
            representativeFace: stage ? getFaceCSS(stage.face) : null,
            representativeForeground: stage
                ? (stage.pose.color?.toCSS() ?? null)
                : 'var(--wordplay-evaluation-color)',
            representativeBackground: stage
                ? stage.back.toCSS()
                : value instanceof ExceptionValue || value === undefined
                  ? 'var(--wordplay-error)'
                  : null,
            representativeText: stage
                ? new UnicodeString(stage.getRepresentativeText($locales))
                      .substring(0, 1)
                      .toString()
                : value
                  ? value.getRepresentativeText($locales)
                  : EXCEPTION_SYMBOL,
            characterName: null,
        };
    });

    // Add a state variable to hold the character
    let character = $state<Character | null>(null);

    // Effect to fetch the character from the database when characterName changes
    $effect(() => {
        // Clear character if characterName is not valid
        if (!characterName) {
            character = null;
            return;
        }

        // Fetch the character
        DB.Characters.getByName(characterName)
            .then((result) => {
                if (result) {
                    character = result;
                } else {
                    character = null;
                }
            })
            .catch((error) => {
                console.error('Failed to load character:', characterName, error);
                character = null;
            });
    });

    const user = getUser();

    let path = $derived(link ?? project.getLink(true));
    /** See if this is a public project being viewed by someone who isn't a creator or collaborator */
    let audience = $derived(isAudience($user, project));

    const owner = $derived(project.getOwner());
    const collaborators = $derived(project.getCollaborators());
    const editable = $derived(
        $user !== null &&
            ($user.uid === owner || collaborators.includes($user.uid)),
    );

    let chat = $state<Chat | undefined>(undefined);
    $effect(() => {
        // When the project changes, get the chat, and mark read if it was unread.
        Chats.getChat(project).then((retrievedChat) => {
            if (retrievedChat) chat = retrievedChat;
        });
    });

    let unread = $derived(
        chat !== undefined && $user !== null && chat.hasUnread($user.uid),
    );
</script>

<div class="project" class:named={name}>
    <a
        class="preview"
        data-testid="preview"
        data-sveltekit-preload-data="tap"
        style:width={`${size}rem`}
        style:height={`${size}rem`}
        href={action ? undefined : path}
        onclick={(event) =>
            action && event.button === 0 ? action() : undefined}
        onkeydown={(event) =>
            action && (event.key === '' || event.key === 'Enter')
                ? action()
                : undefined}
    >
        <div
            class="output"
            role="presentation"
            style:background={representativeBackground}
            style:color={representativeForeground}
            style:font-family={representativeFace}
            style:font-size={`${Math.max(4, size - 3)}rem`}
            class:blurred={audience && isFlagged(project.getFlags())}
        >
            {#if character}
                {@html characterToSVG(character, '100%')}
            {:else}
                {representativeText}
            {/if}
        </div>
    </a>
    {#if name}
        <div class="name">
            {#if action}
                {project.getName()}
            {:else}
                <Link to={path}>
                    {#if project.getName().length === 0}<em class="untitled"
                            >&mdash;</em
                        >
                    {:else}
                        {project.getName()}{/if}</Link
                >
                {#if navigating && `${navigating.to?.url.pathname}${navigating.to?.url.search}` === path}
                    <Spinning />{:else}{@render children?.()}
                {/if}
            {/if}

            <!-- If editable and there's an owner, possibly show collaborators. -->
            {#if editable && owner !== null && showCollaborators && collaborators.length > 0}
                <div class="creators">
                    {#await Creators.getCreator(owner)}
                        <Spinning />
                    {:then creator}
                        <CreatorView {anonymize} {creator} />
                    {/await}
                    {#each collaborators.slice(0, 2) as collaborator}
                        {#await Creators.getCreator(collaborator)}
                            <Spinning />
                        {:then collaboratorCreator}
                            <CreatorView
                                {anonymize}
                                creator={collaboratorCreator}
                            />
                        {/await}
                    {/each}
                    {#if collaborators.length > 2}
                        <span>...</span>
                    {/if}
                </div>
            {/if}
            {#if unread}
                <div class="notification">{PHRASE_SYMBOL}</div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .project {
        border: var(--wordplay-border-color);
        border-radius: var(--wordplay-border-radius);
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--wordplay-spacing);
    }

    .project.named {
        min-width: 12em;
    }

    .output {
        display: flex;
        /** For some reason this is necessary for keeping the character centered. */
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        background: var(--wordplay-background);
        text-decoration: none;
        color: var(--wordplay-foreground);
    }

    a {
        text-decoration: none;
    }

    .name {
        display: flex;
        flex-direction: column;
    }

    .untitled {
        color: var(--wordplay-inactive-color);
    }

    .preview {
        transition: transform ease-out;
        transition-duration: calc(var(--animation-factor) * 200ms);
        background: var(--wordplay-inactive-color);
    }

    .project .preview:hover,
    .project:focus .preview {
        transform: scale(1.05);
    }

    .preview {
        cursor: pointer;
        overflow: hidden;
        border: var(--wordplay-border-color) solid var(--wordplay-border-width);
        border-radius: var(--wordplay-border-radius);
    }

    .preview:hover {
        border-color: var(--wordplay-highlight-color);
        border-width: var(--wordplay-focus-width);
    }

    .blurred {
        filter: blur(10px);
    }

    .notification {
        display: inline-block;
        background: var(--wordplay-highlight-color);
        color: var(--wordplay-background);
        align-self: flex-start;
        border-radius: var(--wordplay-border-radius);
        animation: bounce;
        animation-duration: calc(var(--animation-factor) * 1000ms);
        animation-delay: 0;
        animation-iteration-count: infinite;
    }

    .creators {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        margin-block-start: var(--wordplay-spacing);
        gap: var(--wordplay-spacing);
        row-gap: var(--wordplay-spacing);
    }
</style>