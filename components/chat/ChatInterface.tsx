'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

// Format assistant messages with proper typography and spacing
function formatAssistantMessage(content: string): string {
  return content
    // Convert **bold** to <strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Convert *italic* to <em>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Add line breaks for better paragraph spacing
    .replace(/\n\n/g, '</p><p>')
    // Wrap everything in paragraph tags
    .replace(/^(.+)$/, '<p>$1</p>')
    // Fix double paragraph tags
    .replace(/<p><\/p><p>/g, '<p>')
    // Handle numbered lists (1., 2., etc.)
    .replace(/^(\d+\.\s)/gm, '<br><strong>$1</strong>')
    // Handle bullet points (-, •, *)
    .replace(/^([-•*]\s)/gm, '<br><strong>$1</strong>')
    // Add spacing after periods for better readability
    .replace(/\. ([A-Z])/g, '. $1')
    // Handle document references in brackets
    .replace(/\[(.*?)\]/g, '<em style="color: #666; font-size: 0.9em;">[$1]</em>')
    // Clean up any empty paragraphs
    .replace(/<p><\/p>/g, '');
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncMeetings = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      // Add success message to chat
      const syncMessage: Message = {
        id: Date.now().toString(),
        content: `✅ Successfully synced ${result.count} meetings to your knowledge base!`,
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, syncMessage]);
    } catch (error) {
      console.error('Sync error:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: '❌ Failed to sync meetings. Please check your API configuration.',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Agent
          </CardTitle>
          <Button
            onClick={handleSyncMeetings}
            disabled={isSyncing}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Meetings'}
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 mb-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Welcome! Ask me anything about your documents or sync your meetings to get started.</p>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex gap-2 max-w-[80%] ${
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div className={`rounded-full p-2 ${
                      message.role === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={`rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className={`prose prose-sm max-w-none ${
                        message.role === 'user' ? 'prose-invert' : ''
                      }`}>
                        {message.role === 'assistant' ? (
                          <div 
                            className="whitespace-pre-wrap leading-relaxed"
                            dangerouslySetInnerHTML={{ 
                              __html: formatAssistantMessage(message.content) 
                            }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap m-0">{message.content}</p>
                        )}
                      </div>
                      <span className="text-xs opacity-70 mt-2 block">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <div className="rounded-full p-2 bg-gray-200">
                      <Bot className="h-4 w-4 animate-pulse" />
                    </div>
                    <div className="rounded-lg p-3 bg-gray-100">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}