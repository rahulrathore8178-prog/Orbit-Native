import { ReactNode } from "react";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { colors } from "./theme";

type IconProps = { size?: number; color?: string };

const Icon = ({ children, size = 20, color = colors.n100 }: IconProps & { children: ReactNode }) => (
    <Svg
    width= { size }
height = { size }
viewBox = "0 0 24 24"
fill = "none"
stroke = { color }
strokeWidth = { 1.8}
strokeLinecap = "round"
strokeLinejoin = "round"
    >
    { children }
    </Svg>
);

export const ClockIcon = (p: IconProps) => (
    <Icon { ...p } >
    <Circle cx= "12" cy = "12" r = "9" />
        <Path d="M12 7v5l3 2" />
            </Icon>
);
export const SearchIcon = (p: IconProps) => (
    <Icon { ...p } >
    <Circle cx= "11" cy = "11" r = "7" />
        <Path d="m20 20-3.5-3.5" />
            </Icon>
);
export const CloseIcon = (p: IconProps) => (
    <Icon { ...p } >
    <Path d= "M6 6l12 12M18 6 6 18" />
    </Icon>
);
export const CheckIcon = (p: IconProps) => (
    <Icon { ...p } >
    <Path d= "m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
);
export const MessageIcon = (p: IconProps) => (
    <Icon { ...p } >
    <Path d= "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
    </Icon>
);
export const UserPlusIcon = (p: IconProps) => (
    <Icon { ...p } >
    <Circle cx= "10" cy = "8" r = "3.6" />
        <Path d="M3.5 20c.6-3.4 3.2-5.4 6.5-5.4M18 9v6M15 12h6" />
            </Icon>
);
export const OrbitMark = (p: IconProps) => (
    <Icon { ...p } >
    <Circle cx= "12" cy = "12" r = "3" />
        <Ellipse cx="12" cy = "12" rx = "10" ry = "4.5" rotation = {- 25} origin = "12, 12" />
            </Icon>
);