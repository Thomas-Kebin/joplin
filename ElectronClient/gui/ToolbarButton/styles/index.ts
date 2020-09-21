const styled = require('styled-components').default;
const { css } = require('styled-components');

interface RootProps {
	readonly theme: any;
	readonly disabled: boolean;
	readonly hasTitle: boolean;
}

export const StyledRoot = styled.a<RootProps>`
	opacity: ${(props:RootProps) => props.disabled ? 0.3 : 1};
	height: ${(props:RootProps) => props.theme.toolbarHeight}px;
	min-height: ${(props:RootProps) => props.theme.toolbarHeight}px;
	width: ${(props:RootProps) => props.hasTitle ? 'auto' : `${props.theme.toolbarHeight}px`};
	max-width: ${(props:RootProps) => props.hasTitle ? 'auto' : `${props.theme.toolbarHeight}px`};
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: default;
	border-radius: 3px;
	box-sizing: border-box;

	&:hover {
		background-color: ${(props:RootProps) => props.disabled ? 'none' : props.theme.backgroundColorHover3};
	}
`;

interface IconProps {
	readonly theme: any;
	readonly title: string;
}

const iconStyle = css<IconProps>`
	font-size: ${(props:IconProps) => props.theme.toolbarIconSize}px;
	color: ${(props:IconProps) => props.theme.color3};
	margin-right: ${(props:IconProps) => props.title ? 5 : 0}px;
`;

export const StyledIconI = styled.i`${iconStyle}`;
export const StyledIconSpan = styled.span`${iconStyle}`;
