/**
 * Duotone icons reconstructed from Figma layer exports (see src/assets/icons/svgs.ts).
 * Each icon is a 24x24 (design units) box with absolutely-positioned vector layers,
 * using the exact inset geometry from the Figma design context.
 */
import React from 'react';
import { useColorScheme, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as svg from '../assets/icons/svgs';

type LayerSpec = { xml: string; l: number; t: number; w: number; h: number };

export type IconProps = { size?: number };

/** Remap the Figma light-ink fills for dark mode (cached per layer). */
const darkCache = new Map<string, string>();
const darkXml = (xml: string): string => {
  let out = darkCache.get(xml);
  if (!out) {
    out = xml
      .replace(/#040415/gi, '#F2F2F7')
      .replace(/#EAECF0/gi, '#252638')
      .replace(/#CDCDD0/gi, '#3E3F52');
    darkCache.set(xml, out);
  }
  return out;
};

function makeIcon(base: number, layers: LayerSpec[]) {
  return function Icon({ size = base }: IconProps) {
    const s = size / base;
    const dark = useColorScheme() === 'dark';
    return (
      <View style={{ width: size, height: size }}>
        {layers.map((layer, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: layer.l * s,
              top: layer.t * s,
              width: layer.w * s,
              height: layer.h * s,
            }}
          >
            <SvgXml
              xml={dark ? darkXml(layer.xml) : layer.xml}
              width="100%"
              height="100%"
            />
          </View>
        ))}
      </View>
    );
  };
}

export const HomeIcon = makeIcon(24, [
  { xml: svg.homePri, l: 2.5, t: 2, w: 19, h: 20 },
]);

export const DiscoveryIcon = makeIcon(24, [
  { xml: svg.discoverySec, l: 2, t: 2, w: 20, h: 20 },
  { xml: svg.discoveryPri, l: 8.12, t: 8.11, w: 7.76, h: 7.77 },
]);

export const MedalIcon = makeIcon(24, [
  { xml: svg.medal1, l: 4.01, t: 2, w: 15.99, h: 7.85 },
  { xml: svg.medal2, l: 5, t: 8, w: 14, h: 14 },
  { xml: svg.medal3, l: 10, t: 13, w: 4, h: 4 },
]);

export const ProfileIcon = makeIcon(24, [
  { xml: svg.profileSec, l: 6.71, t: 2, w: 10.58, h: 10.58 },
  { xml: svg.profilePri, l: 4, t: 15.18, w: 16, h: 6.82 },
]);

export const CalendarIcon = makeIcon(24, [
  { xml: svg.calendarSec, l: 3, t: 3.49, w: 18, h: 5.77 },
  { xml: svg.calendarPri, l: 3, t: 2, w: 18, h: 20 },
]);

export const NotificationIcon = makeIcon(24, [
  { xml: svg.notifSec, l: 9.07, t: 19.15, w: 5.83, h: 2.85 },
  { xml: svg.notifPri, l: 3.5, t: 2, w: 17, h: 16 },
]);

export const SettingsIcon = makeIcon(24, [
  { xml: svg.settingsSec, l: 2.5, t: 2, w: 19, h: 20 },
  { xml: svg.settingsPri, l: 9.11, t: 9.18, w: 5.77, h: 5.65 },
]);

export const TimeCircleIcon = makeIcon(24, [
  { xml: svg.timeSec, l: 2, t: 2, w: 20, h: 20 },
  { xml: svg.timePri, l: 10.9, t: 6.93, w: 5.43, h: 8.89 },
]);

export const TickSquareIcon = makeIcon(24, [
  { xml: svg.tickPri, l: 7, t: 8, w: 10, h: 8 },
]);

export const PlusIcon = makeIcon(24, [
  { xml: svg.plusPri, l: 6, t: 6, w: 12, h: 12 },
]);

/** Filled circular plus used as the tab bar center action (48pt). */
export const PlusCircleIcon = makeIcon(48, [
  { xml: svg.pluscfOuter, l: 4, t: 4, w: 40, h: 40 },
  { xml: svg.pluscfInner, l: 14, t: 14, w: 20, h: 20 },
]);

/** Small red notification dot. */
export const DotIcon = makeIcon(8, [{ xml: svg.dot, l: 0, t: 0, w: 8, h: 8 }]);

/** The Routiner mark as a quiet monochrome glyph (Home header → Assistant). */
export const AssistantIcon = makeIcon(24, [
  { xml: svg.assistantMark, l: 0, t: 0, w: 24, h: 24 },
]);
