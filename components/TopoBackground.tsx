import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../lib/theme';

// Static, hand-authored contour lines — low-opacity decoration only.
// Not procedurally generated so it's cheap and deterministic.
export default function TopoBackground() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <Path
          d="M-20,120 C60,80 140,160 220,110 C300,60 360,130 420,90"
          stroke={colors.offWhite}
          strokeWidth={1}
          fill="none"
          strokeOpacity={0.05}
        />
        <Path
          d="M-20,220 C70,260 150,180 230,230 C310,280 370,200 420,240"
          stroke={colors.offWhite}
          strokeWidth={1}
          fill="none"
          strokeOpacity={0.04}
        />
        <Path
          d="M-20,420 C80,380 160,460 240,410 C320,360 370,440 420,400"
          stroke={colors.emeraldLight}
          strokeWidth={1}
          fill="none"
          strokeOpacity={0.06}
        />
        <Path
          d="M-20,540 C70,580 150,500 230,550 C310,600 370,520 420,560"
          stroke={colors.offWhite}
          strokeWidth={1}
          fill="none"
          strokeOpacity={0.04}
        />
        <Path
          d="M-20,680 C80,640 160,720 240,670 C320,620 370,700 420,660"
          stroke={colors.gold}
          strokeWidth={1}
          fill="none"
          strokeOpacity={0.05}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
