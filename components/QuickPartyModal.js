import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from './ui/BottomSheet';
import FormField from './ui/FormField';
import Button from './ui/Button';
import { InlineError } from './ui/ListStates';
import { useToast } from './ui/Toast';
import { apiFetch } from '../lib/api';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

/**
 * `prefill` seeds the form the moment the sheet opens — used by scan-to-entry,
 * where Textract read a party off the paper that isn't in the catalog yet
 * (name, and the PAN / phone printed alongside it). Seeding happens on the
 * open transition only, so a user editing a prefilled field never has their
 * typing overwritten by a re-render.
 */
export default function QuickPartyModal({
  visible,
  onClose,
  defaultType = 'Customer',
  onPartyCreated,
  prefill = null,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setName(prefill?.name ? String(prefill.name) : '');
    setPhoneNumber(prefill?.phoneNumber ? String(prefill.phoneNumber) : '');
    setPanNumber(prefill?.panNumber ? String(prefill.panNumber) : '');
    setAddress(prefill?.address ? String(prefill.address) : '');
    setType(defaultType);
    setError(null);
    // Deliberately keyed on `visible` alone: re-seeding on every prefill
    // identity change would wipe out what the user has typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleReset() {
    setName('');
    setType(defaultType);
    setPhoneNumber('');
    setPanNumber('');
    setAddress('');
    setError(null);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('parties.partyNameRequired', { defaultValue: 'Party name is required' }));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: trimmedName,
        type,
        phoneNumber: phoneNumber.trim() || undefined,
        panNumber: panNumber.trim() || undefined,
        address: address.trim() || undefined,
      };

      // `raw` because createParty() answers `{ ok: true, id }` with no `data`
      // key — apiFetch's default unwrap would return undefined and every
      // create would fail with "Failed to create party".
      const res = await apiFetch('/api/parties', {
        method: 'POST',
        body: payload,
        raw: true,
      });

      const newId = res?.id ?? res?.data?.id;
      if (!newId) {
        throw new Error(t('common.somethingWentWrong'));
      }

      const createdParty = {
        id: newId,
        name: trimmedName,
        type,
        phoneNumber: phoneNumber.trim(),
        panNumber: panNumber.trim(),
        address: address.trim(),
      };

      showToast(t('parties.partyCreated', { defaultValue: 'Party created and selected' }), 'success');
      onPartyCreated(createdParty);
      handleReset();
      onClose();
    } catch (err) {
      // createParty reports duplicates as fieldErrors ({ name: ["partyNameExists"] },
      // and the same for PAN / phone), which carry no messageKey — surface those
      // first, otherwise a duplicate PAN prefilled from a scan just said
      // "something went wrong" with no hint of which field to fix.
      const fieldCode = ['name', 'panNumber', 'phoneNumber'].map((field) => err?.fieldErrors?.[field]?.[0]).find(Boolean);
      if (fieldCode) {
        setError(t(`parties.${fieldCode}`, { defaultValue: t('common.somethingWentWrong') }));
      } else {
        setError(err?.messageKey ? t(err.messageKey) : (err?.message || t('common.somethingWentWrong')));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const PARTY_TYPES = [
    { key: 'Customer', label: t('parties.typeCustomer', { defaultValue: 'Customer' }) },
    { key: 'Supplier', label: t('parties.typeSupplier', { defaultValue: 'Supplier' }) },
    { key: 'Both', label: t('parties.typeBoth', { defaultValue: 'Both' }) },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={t('parties.createParty', { defaultValue: 'Add New Party' })}
      maxHeightRatio={0.88}
      footer={
        <View style={styles.footerRow}>
          <Button
            label={t('common.cancel')}
            variant='secondary'
            onPress={handleClose}
            style={styles.footerSecondary}
            disabled={submitting}
          />
          <Button
            label={t('parties.saveAndSelect', { defaultValue: 'Save & Select' })}
            onPress={handleSave}
            loading={submitting}
            style={styles.footerPrimary}
          />
        </View>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <InlineError message={error} />

        <FormField
          label={t('parties.partyName', { defaultValue: 'Party Name' })}
          placeholder={t('parties.partyNamePlaceholder', { defaultValue: 'e.g. Ram Traders' })}
          required
          value={name}
          onChangeText={(val) => {
            setName(val);
            if (error) setError(null);
          }}
          autoFocus
        />

        <Text style={styles.sectionLabel}>{t('parties.partyType', { defaultValue: 'Party Type' })}</Text>
        <View style={styles.typeSegment}>
          {PARTY_TYPES.map((pt) => {
            const active = type === pt.key;
            return (
              <TouchableOpacity
                key={pt.key}
                style={[styles.typeButton, active && styles.typeButtonActive]}
                onPress={() => setType(pt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeButtonText, active && styles.typeButtonTextActive]}>
                  {pt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FormField
          label={t('parties.phone', { defaultValue: 'Phone' })}
          placeholder='98XXXXXXXX'
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType='phone-pad'
        />

        <FormField
          label={t('parties.panNumber', { defaultValue: 'PAN Number' })}
          placeholder='XXXXXXXXX'
          value={panNumber}
          onChangeText={setPanNumber}
          keyboardType='number-pad'
        />

        <FormField
          label={t('parties.address', { defaultValue: 'Address' })}
          placeholder={t('parties.addressPlaceholder', { defaultValue: 'e.g. Kathmandu' })}
          value={address}
          onChangeText={setAddress}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 },
  sectionLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  typeSegment: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: colors.bodyBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  typeButtonActive: {
    backgroundColor: 'rgba(152,95,253,0.12)',
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  typeButtonTextActive: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerSecondary: { flex: 1 },
  footerPrimary: { flex: 2 },
});