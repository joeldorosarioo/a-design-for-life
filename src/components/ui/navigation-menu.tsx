'use client';

import type { ComponentProps } from 'react';
import { NavigationMenu as NavigationMenuPrimitive } from 'radix-ui';

// shadcn Navigation Menu with the portfolio's flat link layout.
function NavigationMenu(props: ComponentProps<typeof NavigationMenuPrimitive.Root>) {
  return <NavigationMenuPrimitive.Root data-slot="navigation-menu" {...props} />;
}

function NavigationMenuList(props: ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return <NavigationMenuPrimitive.List data-slot="navigation-menu-list" {...props} />;
}

function NavigationMenuItem(props: ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return <NavigationMenuPrimitive.Item data-slot="navigation-menu-item" {...props} />;
}

function NavigationMenuLink(props: ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return <NavigationMenuPrimitive.Link data-slot="navigation-menu-link" {...props} />;
}

export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink };
