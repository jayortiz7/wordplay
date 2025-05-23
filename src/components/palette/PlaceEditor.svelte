<script lang="ts">
    import setKeyboardFocus from '@components/util/setKeyboardFocus';
    import LocalizedText from '@components/widgets/LocalizedText.svelte';
    import type Project from '@db/projects/Project';
    import type LocaleText from '@locale/LocaleText';
    import NumberLiteral from '@nodes/NumberLiteral';
    import Unit from '@nodes/Unit';
    import NumberValue from '@values/NumberValue';
    import { tick } from 'svelte';
    import { Projects, locales } from '../../db/Database';
    import type Bind from '../../nodes/Bind';
    import Evaluate from '../../nodes/Evaluate';
    import Expression from '../../nodes/Expression';
    import NumberType from '../../nodes/NumberType';
    import Button from '../widgets/Button.svelte';
    import Note from '../widgets/Note.svelte';
    import TextField from '../widgets/TextField.svelte';
    import { getNumber } from './editOutput';

    interface Props {
        project: Project;
        place: Evaluate;
        editable: boolean;
        convertable: boolean;
        id?: string | undefined;
    }

    let {
        project,
        place,
        editable,
        convertable,
        id = undefined,
    }: Props = $props();

    let views: HTMLInputElement[] = $state([]);

    function valid(val: string) {
        const [num] = NumberValue.fromUnknown(val);
        return num.isNaN() ? (l: LocaleText) => l.ui.palette.error.nan : true;
    }

    async function handleChange(dimension: Bind, value: string) {
        if (place === undefined) return;
        if (value.length > 0 && !valid(value)) return;

        const focusIndex = views.findIndex(
            (view) => document.activeElement === view,
        );

        Projects.revise(project, [
            [
                place,
                place.withBindAs(
                    dimension,
                    NumberLiteral.make(
                        value.length === 0 ? 0 : value,
                        getUnit(dimension),
                    ),
                    project.getNodeContext(place),
                ),
            ],
        ]);

        if (focusIndex >= 0) {
            await tick();
            const view = views[focusIndex];
            if (view)
                setKeyboardFocus(
                    view,
                    'Restoring focus after place editor edit.',
                );
        }
    }

    function getUnit(bind: Bind) {
        const types =
            bind.type === undefined
                ? []
                : bind.type.getPossibleTypes(project.getNodeContext(place));
        const unit = types.find(
            (type): type is NumberType => type instanceof NumberType,
        )?.unit;
        return unit instanceof Unit ? unit.clone() : undefined;
    }
</script>

{project.shares.output.Place.names.getSymbolicName()}
<div class="place" {id}>
    {#each project.shares.output.Place.inputs as dimension, index}
        {@const given = place?.getInput(
            dimension,
            project.getNodeContext(place),
        )}
        <!-- Get the measurement literal, if there is one -->
        {@const value =
            given instanceof Expression ? getNumber(given) : undefined}
        <div class="dimension">
            {#if value !== undefined || given == undefined}
                <TextField
                    id="place-editor-{index}"
                    text={`${value ?? 0}`}
                    validator={valid}
                    {editable}
                    placeholder={dimension.names.getNames()[0]}
                    description={(l) => l.ui.palette.field.coordinate}
                    changed={(value) => handleChange(dimension, value)}
                    bind:view={views[index]}
                />
                <Note>{getUnit(dimension)?.toWordplay() ?? ''}</Note>
            {:else}
                <Note
                    ><LocalizedText
                        path={(locale) => locale.ui.palette.labels.computed}
                    /></Note
                >
            {/if}
        </div>
    {/each}
</div>
{#if convertable}
    <Button
        tip={(l) => l.ui.palette.button.addMotion}
        active={editable}
        action={() => {
            Projects.revise(project, [
                [
                    place,
                    Evaluate.make(
                        project.shares.input.Motion.getReference($locales),
                        [
                            place,
                            Evaluate.make(
                                project.shares.output.Velocity.getReference(
                                    $locales,
                                ),
                                [
                                    NumberLiteral.make(
                                        0,
                                        Unit.create(['m'], ['s']),
                                    ),
                                    NumberLiteral.make(
                                        0,
                                        Unit.create(['m'], ['s']),
                                    ),
                                    NumberLiteral.make(
                                        0,
                                        Unit.create(['°'], ['s']),
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ]);
        }}
        icon="→">{project.shares.input.Motion.getNames()[0]}</Button
    >
    <Button
        tip={(l) => l.ui.palette.button.addPlacement}
        active={editable}
        action={() => {
            Projects.revise(project, [
                [
                    place,
                    Evaluate.make(
                        project.shares.input.Placement.getReference($locales),
                        [place],
                    ),
                ],
            ]);
        }}
        icon="→">{project.shares.input.Placement.getNames()[0]}</Button
    >
{/if}

<style>
    .place {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: var(--wordplay-spacing);
        align-items: baseline;
    }

    .dimension {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: baseline;
        width: 5em;
    }
</style>
