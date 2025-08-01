"use client"

import { useState } from "react"
import { ChevronDown, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface ToolbarProps {
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

export function Toolbar({ canUndo = false, canRedo = false, onUndo, onRedo }: ToolbarProps) {
  const [selectedFont, setSelectedFont] = useState("Calibri")
  const [selectedSize, setSelectedSize] = useState("11")

  return (
    <div className="flex items-center px-4 py-2 bg-gray-50 border-b space-x-1">
      {/* Clipboard Section */}
      <div className="flex flex-col items-center mr-4">
        <div className="flex space-x-1">
          <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
            <span className="text-lg">📋</span>
            <span className="text-xs">Paste</span>
          </Button>
        </div>
        <div className="flex space-x-1 mt-1">
          <Button
            variant="ghost"
            size="sm"
            className={`text-xs px-2 py-1 ${!canUndo ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={onUndo}
            disabled={!canUndo}
          >
            Undo
          </Button>
          <Button variant="ghost" size="sm" className="text-xs px-2 py-1">
            Clipboard
          </Button>
        </div>
      </div>

      <div className="w-px h-12 bg-gray-300 mx-2" />

      {/* Font Section */}
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                <span className="text-sm">{selectedFont}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedFont("Calibri")}>Calibri</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedFont("Arial")}>Arial</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedFont("Times New Roman")}>Times New Roman</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                <span className="text-sm">{selectedSize}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedSize("8")}>8</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSize("9")}>9</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSize("10")}>10</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSize("11")}>11</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSize("12")}>12</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="sm" className="p-1">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="p-1">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="p-1">
            <Underline className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" className="p-1">
              <span className="text-sm">🎨</span>
            </Button>
            <Button variant="ghost" size="sm" className="p-1">
              <span className="text-sm">🎨</span>
            </Button>
          </div>
        </div>
        <span className="text-xs text-center">Fonts</span>
      </div>

      <div className="w-px h-12 bg-gray-300 mx-2" />

      {/* Alignment Section */}
      <div className="flex flex-col items-center">
        <div className="flex space-x-1">
          <Button variant="ghost" size="sm" className="p-1">
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="p-1">
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="p-1">
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex space-x-1 mt-1">
          <Button variant="ghost" size="sm" className="text-xs px-2 py-1">
            Wrap Text
          </Button>
          <Button variant="ghost" size="sm" className="text-xs px-2 py-1">
            Merge & Center
          </Button>
        </div>
        <span className="text-xs">Alignment</span>
      </div>

      <div className="w-px h-12 bg-gray-300 mx-2" />

      {/* Numbers Section */}
      <div className="flex flex-col items-center">
        <div className="flex space-x-1">
          <Button variant="ghost" size="sm" className="text-sm">
            %
          </Button>
          <Button variant="ghost" size="sm" className="text-sm">
            ,
          </Button>
          <Button variant="ghost" size="sm" className="text-sm">
            .00
          </Button>
          <Button variant="ghost" size="sm" className="text-sm">
            .0
          </Button>
        </div>
        <span className="text-xs mt-2">Numbers</span>
      </div>

      <div className="w-px h-12 bg-gray-300 mx-2" />

      {/* Styles Section */}
      <div className="flex space-x-2">
        <div className="flex flex-col items-center">
          <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
            <span className="text-lg">📊</span>
            <span className="text-xs">Conditional Format</span>
          </Button>
        </div>
        <div className="flex flex-col items-center">
          <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
            <span className="text-lg">📋</span>
            <span className="text-xs">Format Table</span>
          </Button>
        </div>
        <div className="flex flex-col items-center">
          <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
            <span className="text-lg">🎨</span>
            <span className="text-xs">Cell Styles</span>
          </Button>
        </div>
      </div>

      <div className="w-px h-12 bg-gray-300 mx-2" />

      {/* Cells Section */}
      <div className="flex flex-col items-center">
        <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
          <span className="text-lg">📝</span>
          <span className="text-xs">Cells</span>
        </Button>
      </div>

      <div className="w-px h-12 bg-gray-300 mx-2" />

      {/* Editing Section */}
      <div className="flex flex-col items-center">
        <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
          <span className="text-lg">✏️</span>
          <span className="text-xs">Editing</span>
        </Button>
      </div>
    </div>
  )
}
