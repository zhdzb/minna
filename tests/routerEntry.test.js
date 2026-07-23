import { describe, expect, it } from 'vitest'
import router from '../src/router/index.js'

describe('router entry cleanup', () => {
  it('redirects the root path into the new agent-study flow', () => {
    const rootRoute = router.getRoutes().find((route) => route.path === '/')

    expect(rootRoute).toBeTruthy()
    expect(rootRoute.redirect).toBe('/agent-study')
  })

  it('keeps the new agent-study pages as the primary named entry routes', () => {
    const routeNames = router.getRoutes().map((route) => route.name).filter(Boolean)

    expect(routeNames).toContain('AgentStudyWorkspace')
    expect(routeNames).toContain('AgentProgressReview')
    expect(routeNames).toContain('AgentReviewDrill')
    expect(routeNames).toContain('ListeningLab')
    expect(routeNames).not.toContain('Dashboard')
    expect(routeNames).not.toContain('TrainingEngine')
    expect(routeNames).not.toContain('PatternSubstitutionMode')
    expect(routeNames).not.toContain('ListeningKeywordMode')
    expect(routeNames).not.toContain('ShadowingMode')
    expect(routeNames).not.toContain('ScenarioSpeakingMode')
  })
})
