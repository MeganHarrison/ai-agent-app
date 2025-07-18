'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
}

export default function MessageContent({ content, role }: MessageContentProps) {
  return (
    <div className={`prose ${role === 'user' ? 'prose-invert' : 'prose-slate'} max-w-none prose-sm`}>
      <ReactMarkdown
        components={{
        // Headings
        h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-semibold mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-semibold mb-2">{children}</h3>,
        
        // Paragraphs
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        
        // Lists
        ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        
        // Links
        a: ({ href, children }) => {
          // Handle placeholder links differently
          if (href === '#' || !href) {
            return <span className="text-blue-500 font-medium">{children}</span>;
          }
          return (
            <a 
              href={href} 
              className="text-blue-500 hover:text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        
        // Strong/Bold
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        
        // Code blocks
        code: ({ inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              className="rounded-md mb-3 text-sm"
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code 
              className={`px-1 py-0.5 rounded text-sm font-mono ${
                role === 'user' 
                  ? 'bg-blue-600 text-blue-100' 
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {children}
            </code>
          );
        },
        
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 pl-4 my-3 italic">
            {children}
          </blockquote>
        ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}