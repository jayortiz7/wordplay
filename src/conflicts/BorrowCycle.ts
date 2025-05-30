import type LocaleText from '@locale/LocaleText';
import NodeRef from '@locale/NodeRef';
import type Borrow from '@nodes/Borrow';
import type Context from '@nodes/Context';
import type Program from '@nodes/Program';
import type Source from '@nodes/Source';
import type Locales from '../locale/Locales';
import Conflict from './Conflict';

export class BorrowCycle extends Conflict {
    readonly program: Program;
    readonly borrow: Borrow;
    readonly cycle: Source[];

    constructor(program: Program, borrow: Borrow, cycle: Source[]) {
        super(false);
        this.program = program;
        this.borrow = borrow;
        this.cycle = cycle;
    }

    static readonly LocalePath = (locale: LocaleText) =>
        locale.node.Borrow.conflict.BorrowCycle;

    getConflictingNodes() {
        return {
            primary: {
                node: this.borrow,
                explanation: (locales: Locales, context: Context) =>
                    locales.concretize(
                        (l) => BorrowCycle.LocalePath(l).primary,
                        new NodeRef(
                            this.borrow,
                            locales,
                            context,
                            locales.getName(this.cycle[0].names),
                        ),
                    ),
            },
        };
    }

    getLocalePath() {
        return BorrowCycle.LocalePath;
    }
}
