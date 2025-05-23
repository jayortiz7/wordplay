import type Conflict from '@conflicts/Conflict';
import type LocaleText from '@locale/LocaleText';
import type { NodeDescriptor } from '@locale/NodeTexts';
import type { FontWeight } from '../basis/Fonts';
import Purpose from '../concepts/Purpose';
import type Locales from '../locale/Locales';
import type { TemplateInput } from '../locale/Locales';
import NodeRef from '../locale/NodeRef';
import ValueRef from '../locale/ValueRef';
import Characters from '../lore/BasisCharacters';
import { unescapeMarkupSymbols } from '../parser/Tokenizer';
import { withColorEmoji } from '../unicode/emoji';
import Branch from './Branch';
import ConceptLink from './ConceptLink';
import Content from './Content';
import Example from './Example';
import Mention from './Mention';
import Node, {
    any,
    list,
    node,
    none,
    type Grammar,
    type Replacement,
} from './Node';
import type { NodeSegment, Segment } from './Paragraph';
import Sym from './Sym';
import { unescaped } from './TextLiteral';
import Token from './Token';
import WebLink from './WebLink';

export type Format = 'italic' | 'underline' | 'light' | 'bold' | 'extra';

export default class Words extends Content {
    readonly open: Token | undefined;
    readonly segments: Segment[];
    readonly close: Token | undefined;

    constructor(
        open: Token | undefined,
        words: Segment[],
        close: Token | undefined,
    ) {
        super();

        this.open = open;
        this.segments = words;
        this.close = close;
    }

    static make() {
        return new Words(undefined, [new Token('…', Sym.Words)], undefined);
    }

    getDescriptor(): NodeDescriptor {
        return 'Words';
    }

    getGrammar(): Grammar {
        return [
            {
                name: 'open',
                kind: any(
                    node(Sym.Italic),
                    node(Sym.Underline),
                    node(Sym.Light),
                    node(Sym.Bold),
                    node(Sym.Extra),
                    none(['close', () => new Token(Sym.Italic, Sym.Italic)]),
                ),
            },
            {
                name: 'segments',
                kind: list(
                    true,
                    node(Words),
                    node(WebLink),
                    node(ConceptLink),
                    node(Example),
                    node(Sym.Words),
                    node(Mention),
                    node(Branch),
                ),
            },
            {
                name: 'close',
                kind: any(
                    node(Sym.Italic),
                    node(Sym.Underline),
                    node(Sym.Light),
                    node(Sym.Bold),
                    node(Sym.Extra),
                    none(['open', () => new Token(Sym.Italic, Sym.Italic)]),
                ),
            },
        ];
    }

    computeConflicts(): Conflict[] {
        return [];
    }

    clone(replace?: Replacement | undefined): this {
        return new Words(
            this.replaceChild('open', this.open, replace),
            this.replaceChild('segments', this.getNodeSegments(), replace),
            this.replaceChild('close', this.close, replace),
        ) as this;
    }

    getNodeSegments() {
        return this.segments.filter((s) => s instanceof Node) as NodeSegment[];
    }

    withSegments(segments: Segment[]) {
        return new Words(this.open, segments, this.close);
    }

    getPurpose() {
        return Purpose.Document;
    }

    static readonly LocalePath = (l: LocaleText) => l.node.Words;
    getLocalePath() {
        return Words.LocalePath;
    }

    getFormat(): Format | undefined {
        return this.open === undefined
            ? undefined
            : this.open.isSymbol(Sym.Italic)
              ? 'italic'
              : this.open.isSymbol(Sym.Underline)
                ? 'underline'
                : this.open.isSymbol(Sym.Light)
                  ? 'light'
                  : this.open.isSymbol(Sym.Bold)
                    ? 'bold'
                    : 'extra';
    }

    /** Gets this format and all of the nested formats of segments that wrap the entire Word. */
    getFormats(): Format[] {
        const format = this.getFormat();
        if (format === undefined) return [];
        else if (this.segments.length === 1) {
            return this.segments[0] instanceof Token ||
                !(this.segments[0] instanceof Words)
                ? [format]
                : [format, ...this.segments[0].getFormats()];
        } else return [format];
    }

    getWeight(): FontWeight | undefined {
        return this.open
            ? this.open.isSymbol(Sym.Light)
                ? 300
                : this.open.isSymbol(Sym.Bold)
                  ? 700
                  : this.open.isSymbol(Sym.Extra)
                    ? 900
                    : 400
            : undefined;
    }

    containsText(text: string): boolean {
        return this.segments.some(
            (segment) => segment instanceof Words && segment.containsText(text),
        );
    }

    getCharacter() {
        return Characters.Words;
    }

    concretize(
        locales: Locales,
        inputs: TemplateInput[],
        replacements: [Node, Node][],
    ): Words | undefined {
        const concrete = this.segments.map((content) => {
            if (content instanceof ValueRef || content instanceof NodeRef)
                return content;
            // Replace all repeated special characters with single special characters.
            else if (content instanceof Token) {
                const replacement = content.withText(
                    withColorEmoji(unescapeMarkupSymbols(content.getText())),
                );
                if (replacement.getText() !== content.getText()) {
                    replacements.push([content, replacement]);
                    return replacement;
                } else return content;
            } else return content.concretize(locales, inputs, replacements);
        });
        return concrete.some((s) => s === undefined)
            ? undefined
            : new Words(this.open, concrete as Segment[], this.close);
    }

    isBulleted() {
        return (
            this.segments[0] instanceof Token &&
            this.segments[0].getText().startsWith('•')
        );
    }

    toText(): string {
        return unescaped(
            this.segments.map((segment) => segment.toText()).join(''),
        );
    }
}
