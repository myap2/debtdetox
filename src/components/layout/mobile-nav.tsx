'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SidebarNav } from './sidebar';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-14 items-center gap-3 border-b bg-sidebar px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-64 flex-col gap-0 bg-sidebar p-0">
          <SheetHeader className="h-16 justify-center px-6">
            <SheetTitle className="text-left text-xl font-bold">DebtDetox</SheetTitle>
          </SheetHeader>
          <Separator />
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/" className="text-lg font-bold text-sidebar-foreground">
        DebtDetox
      </Link>
    </div>
  );
}
