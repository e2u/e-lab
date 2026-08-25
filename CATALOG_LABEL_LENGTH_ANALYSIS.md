# Catalog Label Length Analysis

## Current Labels in Relays / Contactors Group

### Contactor Items

| ID | Current English Label | Character Count |
|----|----------------------|-----------------|
| km-coil | Contactor Coil | 14 |
| km-main | Contactor Main Contacts | 23 |
| km-no | Contactor Aux NO (13-14) | 26 |
| km-nc | Contactor Aux NC (21-22) | 26 |
| km-no2 | Contactor Aux NO (43-44) | 27 |
| km-nc2 | Contactor Aux NC (31-32) | 27 |

**Total characters for contactor items: 143**

### Relay Items

| ID | Current English Label | Character Count |
|----|----------------------|-----------------|
| ka-coil | Intermediate Relay | 18 |
| ka-no | Relay Aux NO (1-2) | 20 |
| ka-nc | Relay Aux NC (3-4) | 20 |
| ka-no2 | Relay Aux NO (5-6) | 20 |
| ka-nc2 | Relay Aux NC (7-8) | 20 |

**Total characters for relay items: 98**

---

## Proposed Shortened Labels (NEMA Style)

Based on US electrical standards and common practices, here are recommended shortened labels:

### Contactor Abbreviations Reference

#### Standard NEMA/IEEE Terminology:
- **Contactor** - Full name acceptable, or simply "Contact"
- **Auxiliary Contact** - Common term for auxiliary contacts
- **NO** = Normally Open
- **NC** = Normally Closed
- **Main Contacts** = Main Power Contacts

#### Suggested Shortened Labels:

| ID | Current Label | Proposed Label | Rationale |
|----|--------------|----------------|-----------|
| km-coil | Contactor Coil | Contactor Coil | Keep full (coil is clear) |
| km-main | Contactor Main Contacts | Contactor Main | Shorter, same meaning |
| km-no | Contactor Aux NO (13-14) | Cont. Aux NO 13-14 | "Cont." abbreviation standard |
| km-nc | Contactor Aux NC (21-22) | Cont. Aux NC 21-22 | Consistent format |
| km-no2 | Contactor Aux NO (43-44) | Cont. Aux NO 43-44 | Numbered aux contacts |
| km-nc2 | Contactor Aux NC (31-32) | Cont. Aux NC 31-32 | Numbered aux contacts |

**Savings: ~12 characters total**

### Relay Abbreviations Reference

#### Standard Terms:
- **Relay** - General term
- **Auxiliary Relay Contact** - Formal term
- Often called just "Aux Contact" in diagrams

#### Suggested Shortened Labels:

| ID | Current Label | Proposed Label | Rationale |
|----|--------------|----------------|-----------|
| ka-coil | Intermediate Relay | Relay Coil | Simpler, clearer |
| ka-no | Relay Aux NO (1-2) | Relay Aux NO 1-2 | Remove parentheses (standard) |
| ka-nc | Relay Aux NC (3-4) | Relay Aux NC 3-4 | Consistent format |
| ka-no2 | Relay Aux NO (5-6) | Relay Aux NO 5-6 | Numbered aux contacts |
| ka-nc2 | Relay Aux NC (7-8) | Relay Aux NC 7-8 | Numbered aux contacts |

**Savings: ~10 characters total**

---

## Alternative Compact Format (IEC-style but shorter)

Some engineers prefer even more compact notation used on actual control panels:

| ID | Ultra-Compact | Notes |
|----|---------------|-------|
| km-coil | KM Coil | IEC style, very compact |
| km-main | KM Main | IEC style |
| km-no | KM NO 13-14 | IEC numbered contacts |
| km-nc | KM NC 21-22 | Common panel notation |
| km-no2 | KM NO 43-44 | Numbered auxiliary |
| km-nc2 | KM NC 31-32 | Numbered auxiliary |
| ka-coil | KA Coil | IEC relay coil |
| ka-no | KA NO 1-2 | IEC style |
| ka-nc | KA NC 3-4 | IEC style |
| ka-no2 | KA NO 5-6 | IEC style |
| ka-nc2 | KA NC 7-8 | IEC style |

**Total character count for all items: ~90**
**Space savings vs current: ~51 characters (~36% reduction)**

---

## Comparison Summary

### Character Count Analysis

```
Current labels:     143 + 98 = 241 chars
Proposed NEMA:      ~229 chars (saves ~12)
Ultra-compact:       ~90 chars (saves ~151!)
```

### Readability Trade-off

| Approach | Pros | Cons |
|----------|------|------|
| **Full names** | Very clear, self-documenting | Takes lots of space in palette |
| **NEMA shortened** | Balanced - still readable, saves space | Requires learning abbreviations |
| **IEC compact** | Most space-efficient, matches real-world panels | Less intuitive for beginners |

---

## Recommendation

For an educational simulation tool like e-Lab, I recommend the **"NEMA Shortened"** approach because:

1. ✅ Still clearly describes what each component is
2. ✅ Saves significant space in the left palette
3. ✅ Uses standard US electrical terminology
4. ✅ Good balance between clarity and conciseness
5. ⚠️ Slightly less familiar to absolute beginners than full names

If you want maximum space efficiency and assume users have some electrical background, go with **"IEC Compact"** format.

---

## Implementation Notes

When implementing changes:
1. Update both `label` and `labelEn` fields consistently
2. Consider adding tooltips that show full descriptions on hover
3. Test with different screen sizes to ensure proper display
4. Document the abbreviation system in user guide
