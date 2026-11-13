"use client";
import {createContext} from 'react';

// Exact saved MPEG paths, or an explicit browser-play choice. An old or
// unwrapped caller keeps the existing recorded/synthetic source selection.
export const PwaManualFoleyPathsContext=createContext('');
