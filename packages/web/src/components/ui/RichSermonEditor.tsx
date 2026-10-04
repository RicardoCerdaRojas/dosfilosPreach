import { 
  MDXEditor, 
  MDXEditorMethods, 
  headingsPlugin, 
  listsPlugin, 
  quotePlugin, 
  thematicBreakPlugin, 
  markdownShortcutPlugin,
  toolbarPlugin,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  linkPlugin,
  imagePlugin,
  InsertImage,
  UndoRedo,
  BoldItalicUnderlineToggles,
  tablePlugin,
  InsertTable,
  diffSourcePlugin, 
  DiffSourceToggleWrapper
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { hardLineBreakPlugin } from '@/lib/sermonEditor/hardLineBreak';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface RichSermonEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
}

/**
 * A WYSIWYG Markdown editor using MDXEditor.
 * Supports: Headings, Lists, Quotes, Links, Images, Bold/Italic/Underline.
 */
export const RichSermonEditor = forwardRef<MDXEditorMethods, RichSermonEditorProps>(
  ({ markdown, onChange, className, placeholder }, ref) => {
    return (
      <div className={cn("rich-editor-wrapper min-h-full flex flex-col", className)}>
        <MDXEditor
          ref={ref}
          markdown={markdown}
          onChange={onChange}
          placeholder={placeholder}
          contentEditableClassName="prose prose-sm max-w-none focus:outline-none min-h-[500px] px-8 py-4"
          plugins={[
            // El salto (Mayúsculas+Enter) se guarda estándar (LINE_BREAK_RULE).
            hardLineBreakPlugin(),
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            imagePlugin(),
            tablePlugin(),
            diffSourcePlugin({ viewMode: 'rich-text', diffMarkdown: 'deleted' }),
            markdownShortcutPlugin(),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <DiffSourceToggleWrapper>
                      <BlockTypeSelect />
                      <BoldItalicUnderlineToggles />
                      <ListsToggle />
                      <CreateLink />
                      <InsertImage />
                      <InsertTable />
                  </DiffSourceToggleWrapper>
                </>
              )
            })
          ]}
          className="bg-background"
        />
      </div>
    );
  }
);

RichSermonEditor.displayName = 'RichSermonEditor';
