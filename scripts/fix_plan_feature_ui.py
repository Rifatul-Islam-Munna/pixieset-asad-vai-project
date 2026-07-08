from pathlib import Path

path = Path("frontend/components/dashboard/client-dashboard.tsx")
text = path.read_text()

# Remove the duplicate bypass prop introduced by the grouped migration.
duplicate = '''            bypass={section !== "store-gallery" && page !== "marketing" && !campaignBuilderOpen}
            bypass={section !== "store-gallery" && page !== "marketing" && !campaignBuilderOpen}
'''
text = text.replace(
    duplicate,
    '            bypass={section !== "store-gallery" && page !== "marketing" && !campaignBuilderOpen}\n',
    1,
)

# Keep advanced design controls visible but non-interactive unless the plan allows them.
text = text.replace(
    '''        {activePanel === "typography" && (
          <>''',
    '''        {activePanel === "typography" && (
          <PlanFeatureLock feature="advancedDesign" label="Advanced design">''',
    1,
)
text = text.replace(
    '''          </>
        )}

        {activePanel === "color" && (
          <>''',
    '''          </PlanFeatureLock>
        )}

        {activePanel === "color" && (
          <PlanFeatureLock feature="advancedDesign" label="Advanced design">''',
    1,
)
text = text.replace(
    '''          </>
        )}

        {activePanel === "grid" && (
          <>''',
    '''          </PlanFeatureLock>
        )}

        {activePanel === "grid" && (
          <PlanFeatureLock feature="layouts" label="Layouts">''',
    1,
)

# Access is consumed by PlanFeatureLock; no extra local flags are required.
text = text.replace('  const advancedDesignAccess = usePlanFeatureAccess("advancedDesign");\n', '', 1)
text = text.replace('  const layoutsAccess = usePlanFeatureAccess("layouts");\n', '', 1)

path.write_text(text)
