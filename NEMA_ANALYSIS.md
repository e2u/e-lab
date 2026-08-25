# NEMA Standard Analysis for e-Lab Component Abbreviations

## Executive Summary

This document analyzes the current component abbreviations in the e-Lab project against US NEMA (National Electrical Manufacturers Association) standards and common electrical engineering practices.

## Current State Assessment

### ✅ Compliant with US Standards (No Changes Needed)

These abbreviations are acceptable or commonly used in US electrical diagrams:

| Component Type | Current Prefix | US Standard | Notes |
|---------------|----------------|-------------|-------|
| Circuit Breaker | QF | QF or CB | Both used; QF is more common in industrial controls |
| Fuse | FU | FU | Standard across all regions |
| Contactor Coil | KM → "Contactor Coil" | Full name preferred | Already converted to full text ✓ |
| Relay Coil | KA → "Intermediate Relay" | Full name preferred | Already converted to full text ✓ |
| Overload Relay | FR | FR | Standard (FR = Fault Relay/Fuse Relay) |
| Pushbutton | SB | SB | Standard (SB = Switch Button) |
| Selector Switch | SA | SA | Standard (SA = Switch Action) |
| Limit Switch | SQ | SQ | Standard (SQ = Sequence Switch) |
| Temperature Switch | ST | ST | Acceptable |
| Pressure Switch | SP | SP | Acceptable |
| Flow Meter/Switch | FS | FS | Acceptable |
| Proximity Sensor | SQ | SQ | Acceptable (same as limit switch) |
| Photoelectric Sensor | SQ | SQ | Acceptable |
| Terminal Block | L1, T1 | Line/Load notation | Common practice |

### ⚠️ Considerations for Future Improvement

These could be improved but are not critical issues:

| Component | Current | Alternative | Priority |
|-----------|---------|-------------|----------|
| Generator | G | GEN | Low - G is widely understood |
| Motor | M | MT | Medium - M is standard per NEC |
| Timer | KT | TIM | Low -KT is IEC style |
| Counter | CT | CNT | Low -CT is IEC style |
| Pilot Lamp | HL | PL | Medium -HL is Asian style, PL is American |
| Fan | FF | FN | Low -Both acceptable |
| Solenoid Valve | YV | SV | Medium -YV is Asian style |

### ❌ Non-Standard / Should Be Changed

None currently - previous work already converted Chinese labels to English.

## Detailed Analysis by Category

### 1. Power & Protection Components

#### Circuit Breakers
```
Current: prefix="QF"
Analysis: QF is the IEC designation. In North America:
          - QF is used (especially in older systems)
          - CB (Circuit Breaker) is more modern/common
Recommendation: KEEP AS IS - QF is still widely recognized
```

#### Fuses
```
Current: prefix="FU"
Analysis: FU is universal and accepted worldwide.
Recommendation: NO CHANGE needed
```

#### Isolators/Disconnects
```
Current: prefix="QS"
Analysis: QS is IEC. US often uses:
          - DISC (Disconnector)
          - No prefix (just shows symbol)
Recommendation: LOW PRIORITY - Could add comment documentation
```

### 2. Control Components

#### Contactors
```
Previous: KM (IEC style)
Changed to: "Contactor Coil", "Contactor Main Contacts" etc.
Analysis: Full text descriptions are clearer than abbreviations
        for complex components with multiple parts.
Recommendation: ✅ CORRECT - Keep full names
```

#### Relays
```
Previous: KA (IEC style)
Changed to: "Intermediate Relay", "Relay Aux NO (1-2)" etc.
Analysis: Similar to contactors, descriptive names improve clarity.
Recommendation: ✅ CORRECT - Keep full names
```

#### Pushbuttons and Selectors
```
Current prefixes: SB, SA, SQ
Analysis: These follow IEC 60417 standards which are adopted
        by IEEE and commonly used in US industrial controls.
Recommendation: NO CHANGE needed
```

### 3. Sensors

All sensor types use appropriate prefixes that align with both
IEC and common US practices.

### 4. Motors and Generators

#### Motors
```
Current: prefix="M"
Analysis: M is standard per NEC Article 430 documentation.
        MT could be more explicit but M is perfectly acceptable.
Recommendation: NO CHANGE needed
```

#### Generators
```
Current: prefix="G"
Analysis: G is too generic. Common alternatives:
          - GEN (Generator)
          - GENR (Generator)
          - GTA (Generating Unit)
Recommendation: CONSIDER CHANGING to GEN if you want maximum clarity
```

### 5. Timers, Counters, and Special Devices

#### Timers
```
Current: prefix="KT"
Analysis: K is IEC designating letter for time-related devices.
        US practice varies:
          - KT (keep as-is, understood)
          - TIM (explicit Timer)
          - T (simplest)
Recommendation: LOW PRIORITY - Current is fine for most users
```

## Recommendations Summary

### Immediate Actions Required: NONE
The current implementation already follows good practices by using
descriptive English names instead of cryptic abbreviations where
appropriate.

### Future Enhancements (Optional)

If you want to make the project more explicitly "American-style":

1. **Consider changing generator prefix** from `G` to `GEN`
   - More explicit and avoids confusion with other G devices
   
2. **Document your abbreviation choices**
   - Add a README or comments explaining why certain abbreviations were chosen
   - This helps future contributors understand the design rationale

3. **Add alternate naming support**
   - Could allow switching between "Industrial" (IEC) and "US Standard" naming
   - Would require significant refactoring of catalog system

## Conclusion

✅ The e-Lab project has been updated to use clear, descriptive English labels
that are understandable to US electricians and engineers.

⚠️ Some components still use IEC-style single-letter prefixes (QF, KM, KA, etc.)
but these are widely recognized internationally and do not cause confusion.

🎯 No critical issues found. The component library is suitable for US educational
and professional use.

---

# Appendix A: Contactor & Relay Abbreviation Reference

## Standard US Electrical Terminology

### Contactors (K M)

| Component Type | Full Name | Common Short Form | Panel Notation |
|---------------|-----------|-------------------|----------------|
| Main Coil | Contactor Coil | KM Coil | KM Coil |
| Main Contacts | Contactor Main Contacts | KM Main | KM Main |
| Auxiliary NO | Contactor Aux NO (13-14) | KM NO 13-14 | KM 13-14 |
| Auxiliary NC | Contactor Aux NC (21-22) | KM NC 21-22 | KM 21-22 |

### Relays (K A)

| Component Type | Full Name | Common Short Form | Panel Notation |
|---------------|-----------|-------------------|----------------|
| Coil | Intermediate Relay | KA Coil | KA Coil |
|Auxiliary NO | Relay Aux NO (1-2) | KA NO 1-2 | KA 1-2 |
| Auxiliary NC | Relay Aux NC (3-4) | KA NC 3-4 | KA 3-4 |

## Recommended Palette Labels (NEMA Style)

For e-Lab left panel, these provide good balance:

```
Contactor Coil          → "Contactor Coil"      (keep full)
Contactor Main Contacts → "Contactor Main"       (-6 chars)
Contactor Aux NO        → "Cont. Aux NO 13-14"   (-5 chars, abbreviate "Contactor")
Relay Aux NO            → "Relay Aux NO 1-2"     (-2 chars, remove parens)
```

## Ultra-Compact Option (IEC-style)

If space is very limited and users have electrical background:

```
KM Coil    KM Main    KM NO 13-14    KM NC 21-22
KA Coil    KA NO 1-2  KA NC 3-4
```

This matches actual control panel labeling conventions used in US industrial settings.
