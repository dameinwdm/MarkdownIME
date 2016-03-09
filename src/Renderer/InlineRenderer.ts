namespace MarkdownIME.Renderer {
    export interface IInlineToken {
        isToken: boolean;
        data: string | Node;
    }

    export interface IInlineRule {
        name: string;
    }

    export interface IInlineTokenRule extends IInlineRule {
        /** token chars that this rule needs */
        tokens: string[];
        Proc(InlineRenderProcess): boolean;
    }

    export class InlineRenderProcess {
        renderer: InlineRenderer;
        tokens: IInlineToken[];
        document: Document;

        //iter. the index of current token.
        i: number = 0;

        //the stack that save i
        iStack: number[] = [];

        constructor(renderer, document, tokens) {
            this.renderer = renderer;
            this.document = document;
            this.tokens = tokens;
        }

        /** turn tokens into plain string */
        toString(tokens?: IInlineToken[]) {
            var _t = tokens || this.tokens;
            return _t.map(t => (typeof (t.data) === "string" ? t.data : (<Node>t.data).textContent)).join('');
        }

        /** turn tokens into DocumentFragment */
        toFragment(tokens?: IInlineToken[]): DocumentFragment {
            var _t = tokens || this.tokens;
            var rtn = this.document.createDocumentFragment();
            _t.map(t => {
                var node: Node;
                if (typeof (t.data) === "string") {
                    node = this.document.createTextNode(<string>t.data);
                } else {
                    node = <Node>t.data;
                }
                rtn.appendChild(node);
            })
            return rtn;
        }

        pushi() { this.iStack.push(this.i); }
        popi() { this.i = this.iStack.pop(); }
        stacki(level: number) { return this.iStack[this.iStack.length - level] || 0; }

        isToken(token: IInlineToken, tokenChar: string) { return token && token.isToken && token.data === tokenChar; }

        /** Iterate through all tokens, calling corresponding `InlineBracketRuleBase.Proc()` */
        execute() {
            this.i = 0;
            while (this.i < this.tokens.length) {
                let t = this.tokens[this.i];
                if (t.isToken) {
                    //call every Rule.Proc() until someone handled the data (returning `true`)
                    this.renderer.tokenChars[<string>t.data].some(rule => rule.Proc(this));
                }

                this.i++;
            }
        }
    }

    /**
     * InlineRenderer: Renderer for inline objects
     * 
     * Flow:
     * 
     * 1. Parse: `Renderer.parse(HTMLElement) => IInlineToken[]`
     * 2. Create a Process: `new InlineRenderProcess(...)`
     * 3. Execute: `InlineRenderProcess.execute()`
     * 4. Update HTMLElement
     * 
     * @example 
     * ```
     * var renderer = new MarkdownIME.Renderer.InlineRenderer();
     * // Add Markdown rules here...
     * renderer.RenderNode(node); // where node.innerHTML == "Hello **World<img src=...>**"
     * assert(node.innerHTML == "Hello <b>World<img src=...></b>");
     * ```
     */
    export class InlineRenderer {

        rules: IInlineRule[] = [];

        /** The chars that could be a token */
        tokenChars: { [char: string]: IInlineTokenRule[] } = {};

        /**
         * do render on a Node
         * 
         * @example
         * ```
         * renderer.RenderNode(node); //where node.innerHTML == "Hello **World<img src=...>**"
         * assert(node.innerHTML == "Hello <b>World<img src=...></b>")
         * ```
         */
        public RenderNode(node: HTMLElement) {
            
        }



        /**
         * Extract tokens.
         * 
         * @example
         * ```
         * var tokens = renderer.Parse(node); //where node.innerHTML == "Hello [<img src=...> \\]Welcome](xxx)"
         * tokens[0] == {isToken: false, data: "Hello "}
         * tokens[1] == {isToken: true,  data: "["}
         * tokens[2] == {isToken: false, data: (ElementObject)}
         * tokens[3] == {isToken: false, data: " \\]Welcome"}
         * //...
         * ```
         */
        public parse(contentContainer: Element): IInlineToken[] {
            var rtn: IInlineToken[] = [];

            var childNodes = contentContainer.childNodes, childCount = childNodes.length, i = -1;

            var strBuff: string = "";
            function flushStringBuffer() {
                strBuff && rtn.push({
                    isToken: false,
                    data: strBuff
                });
                strBuff = "";
            }

            while (++i !== childCount) {
                let node = childNodes[i];

                if (node.nodeType !== Node.TEXT_NODE) {
                    rtn.push({
                        isToken: false,
                        data: node
                    });
                    continue;
                }

                let escaped = false;
                let str = node.textContent;

                if (!str.length) continue;

                for (let j = 0; j !== str.length; j++) {
                    let char = str.charAt(j);
                    if (!escaped && this.tokenChars.hasOwnProperty(char)) {
                        flushStringBuffer();
                        rtn.push({
                            isToken: true,
                            data: char
                        });
                        continue; //skip updating strBuff
                    }
                    else if (escaped) escaped = false;
                    else if (char === "\\") escaped = true;

                    strBuff += char;
                }

                flushStringBuffer();
            }

            return rtn;
        }

        /** Add one extra replacing rule */
        public addRule(rule: IInlineRule) {
            this.rules.push(rule);
            if (rule['Proc'] && rule['tokens']) {
                let mem = this.tokenChars;
                rule['tokens'].forEach(tokenChar => {
                    if (mem[tokenChar]) {
                        mem[tokenChar].push(<IInlineTokenRule>rule);
                    } else {
                        mem[tokenChar] = [<IInlineTokenRule>rule];
                    }
                })
            }
        }
        
    }
}
